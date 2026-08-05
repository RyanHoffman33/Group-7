"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assertCanApproveContract,
  isDepositSatisfied,
  paymentScheduleReconcile,
  requiredDepositAmount,
  statusAfterApproval,
  statusAfterDepositSatisfied,
} from "./status";
import { getCloseoutChecks } from "./queries";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidateContracts(id?: string) {
  revalidatePath("/contracts");
  revalidatePath("/contracts/list");
  revalidatePath("/contracts/new");
  revalidatePath("/contracts/approvals");
  revalidatePath("/contracts/change-orders");
  revalidatePath("/contracts/closeout");
  revalidatePath("/work");
  revalidatePath("/billing/deposits");
  if (id) {
    revalidatePath(`/contracts/${id}`);
    revalidatePath(`/work/events/${id}`);
  }
}

function num(v: unknown) {
  return Number(v ?? 0);
}

async function nextContractNumber(): Promise<string> {
  const supabase = createClient();
  const year = new Date().getFullYear();
  const prefix = `ME-${year}-`;
  const { data } = await supabase
    .from("contracts")
    .select("contract_number")
    .like("contract_number", `${prefix}%`)
    .order("contract_number", { ascending: false })
    .limit(1);
  let seq = 1;
  if (data?.[0]?.contract_number) {
    const part = String(data[0].contract_number).split("-").pop();
    seq = (Number(part) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export type CreateContractInput = {
  customer_id: string;
  event_name: string;
  event_type: string;
  event_start: string;
  event_end?: string;
  venue_name?: string;
  venue_city?: string;
  guest_count?: number;
  project_manager_label: string;
  billing_method: string;
  /** Gross before commercial discount (stored as original_contract_value). */
  gross_contract_value?: number;
  /** Net after discount (stored as contract_value). */
  contract_value: number;
  deposit_required: boolean;
  deposit_percent: number;
  minimum_deposit_amount?: number | null;
  discount_amount?: number;
  discount_percent?: number;
  cancellation_policy_text: string;
  cancellation_fee_percent: number;
  notes?: string;
  created_by: string;
  line_items: {
    description: string;
    line_type: string;
    quantity: number;
    unit_rate: number;
    amount: number;
  }[];
  deliverables: {
    code: string;
    title: string;
    description?: string;
    phase: string;
  }[];
  milestones: {
    milestone_key: string;
    label: string;
    amount: number;
    due_date?: string;
    milestone_type: string;
    sequence_no: number;
  }[];
  document?: {
    title: string;
    doc_type: string;
    external_url?: string;
  };
  submit_for_approval?: boolean;
};

export async function createContract(
  input: CreateContractInput,
): Promise<ActionResult> {
  try {
    if (!input.customer_id) return { ok: false, error: "Customer is required." };
    if (!input.event_name?.trim())
      return { ok: false, error: "Event name is required." };
    if (!input.project_manager_label?.trim())
      return { ok: false, error: "Project manager is required." };
    if (!input.event_start)
      return { ok: false, error: "Event start date is required." };
    if (!input.line_items?.length && !input.deliverables?.length) {
      return {
        ok: false,
        error: "Add at least one service line or deliverable.",
      };
    }
    const discountAmount = Math.max(0, num(input.discount_amount));
    const discountPercent = Math.max(0, num(input.discount_percent));
    if (discountAmount > 0 && discountPercent > 0) {
      return {
        ok: false,
        error: "Only one discount method may be active (percentage or fixed amount).",
      };
    }
    if (discountPercent > 100) {
      return { ok: false, error: "Percentage discount must be between 0% and 100%." };
    }
    const gross =
      input.gross_contract_value != null && num(input.gross_contract_value) > 0
        ? num(input.gross_contract_value)
        : num(input.contract_value) + discountAmount;
    if (gross <= 0) {
      return { ok: false, error: "Gross contract value must be greater than zero." };
    }
    if (discountAmount > gross + 1e-9) {
      return {
        ok: false,
        error: "The discount cannot exceed the gross contract value.",
      };
    }
    const netFromFields =
      discountPercent > 0
        ? Math.round(gross * (1 - discountPercent / 100) * 100) / 100
        : Math.round((gross - discountAmount) * 100) / 100;
    const net = Math.max(0, num(input.contract_value) || netFromFields);
    if (net <= 0) {
      return { ok: false, error: "Net contract value must be greater than zero." };
    }

    if (!input.cancellation_policy_text?.trim()) {
      return { ok: false, error: "Cancellation terms are required." };
    }
    if (!input.milestones?.length) {
      return { ok: false, error: "Payment schedule requires at least one milestone." };
    }

    const depositRequired = Boolean(input.deposit_required);
    const depositPercent = depositRequired ? num(input.deposit_percent) : 0;
    const minDeposit = depositRequired
      ? input.minimum_deposit_amount != null && num(input.minimum_deposit_amount) > 0
        ? num(input.minimum_deposit_amount)
        : null
      : null;
    if (depositRequired) {
      if (minDeposit == null && (depositPercent < 0 || depositPercent > 100)) {
        return {
          ok: false,
          error: "Deposit percentage must be between 0% and 100%.",
        };
      }
      const depAmt =
        minDeposit != null && minDeposit > 0
          ? minDeposit
          : Math.round(net * (depositPercent / 100) * 100) / 100;
      if (depAmt > net + 1e-9) {
        return {
          ok: false,
          error: "The required deposit cannot exceed the net contract value.",
        };
      }
    }

    const schedule = paymentScheduleReconcile(
      input.billing_method,
      input.milestones.map((m) => num(m.amount)),
      net,
    );
    if (!schedule.ok) {
      return {
        ok: false,
        error: `Payment schedule total (${schedule.sum}) must equal net contract value (${net}).`,
      };
    }

    const supabase = createClient();
    const contract_number = await nextContractNumber();
    const status = input.submit_for_approval ? "pending_approval" : "draft";

    const { data: contract, error } = await supabase
      .from("contracts")
      .insert({
        customer_id: input.customer_id,
        contract_number,
        event_name: input.event_name.trim(),
        event_type: input.event_type || "corporate_event",
        event_start: input.event_start,
        event_end: input.event_end || null,
        venue_name: input.venue_name || null,
        venue_city: input.venue_city || null,
        guest_count: input.guest_count ?? null,
        project_manager_label: input.project_manager_label.trim(),
        billing_method: input.billing_method || "fixed_price",
        contract_value: net,
        original_contract_value: gross,
        change_order_value_total: 0,
        deposit_required: depositRequired,
        deposit_percent: depositRequired ? depositPercent : 0,
        minimum_deposit_amount: minDeposit,
        requires_deposit_before_work: depositRequired,
        discount_amount: discountPercent > 0 ? 0 : discountAmount,
        discount_percent: discountAmount > 0 ? 0 : discountPercent,
        cancellation_policy_text: input.cancellation_policy_text.trim(),
        cancellation_fee_percent: num(input.cancellation_fee_percent),
        notes: input.notes || null,
        status,
        performance_complete: false,
        submitted_at: input.submit_for_approval ? new Date().toISOString() : null,
        submitted_by: input.submit_for_approval ? input.created_by : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const id = contract.id as string;

    if (input.line_items?.length) {
      const { error: lErr } = await supabase.from("contract_line_items").insert(
        input.line_items.map((li, i) => ({
          contract_id: id,
          line_number: i + 1,
          line_type: li.line_type || "service",
          description: li.description,
          quantity: num(li.quantity) || 1,
          unit_rate: num(li.unit_rate),
          amount: num(li.amount),
          sort_order: i,
        })),
      );
      if (lErr) throw lErr;
    }

    if (input.deliverables?.length) {
      const { error: dErr } = await supabase.from("contract_deliverables").insert(
        input.deliverables.map((d, i) => ({
          contract_id: id,
          code: d.code || `DLV-${i + 1}`,
          title: d.title,
          description: d.description || null,
          phase: d.phase || "planning",
          status: "promised",
          sort_order: i,
        })),
      );
      if (dErr) throw dErr;
    }

    if (input.milestones?.length) {
      const { error: mErr } = await supabase.from("contract_milestones").insert(
        input.milestones.map((m) => ({
          contract_id: id,
          milestone_key: m.milestone_key,
          label: m.label,
          amount: num(m.amount),
          due_date: m.due_date || null,
          completed: false,
          milestone_type: m.milestone_type || "progress",
          sequence_no: m.sequence_no ?? 0,
        })),
      );
      if (mErr) throw mErr;
    }

    if (input.document?.title) {
      await supabase.from("contract_documents").insert({
        contract_id: id,
        doc_type: input.document.doc_type || "proposal",
        title: input.document.title,
        external_url: input.document.external_url || null,
        uploaded_by: input.created_by,
      });
    }

    if (input.submit_for_approval) {
      await supabase.from("contract_approvals").insert({
        contract_id: id,
        action: "submit",
        from_status: "draft",
        to_status: "pending_approval",
        actor_label: input.created_by,
        actor_role: "coordinator",
        comments: "Submitted via create contract workflow",
      });
    }

    revalidateContracts(id);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create contract.",
    };
  }
}

export async function submitContractForApproval(input: {
  contract_id: string;
  actor_label: string;
  comments?: string;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (c.status !== "draft") {
      return { ok: false, error: "Only draft contracts can be submitted." };
    }
    if (!input.actor_label?.trim()) {
      return { ok: false, error: "Submitter name is required." };
    }

    const { error: uErr } = await supabase
      .from("contracts")
      .update({
        status: "pending_approval",
        submitted_at: new Date().toISOString(),
        submitted_by: input.actor_label.trim(),
      })
      .eq("id", input.contract_id);
    if (uErr) throw uErr;

    await supabase.from("contract_approvals").insert({
      contract_id: input.contract_id,
      action: "submit",
      from_status: "draft",
      to_status: "pending_approval",
      actor_label: input.actor_label.trim(),
      actor_role: "coordinator",
      comments: input.comments || null,
    });

    revalidateContracts(input.contract_id);
    return { ok: true, id: input.contract_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Submit failed.",
    };
  }
}

export async function approveContract(input: {
  contract_id: string;
  actor_label: string;
  actor_role?: string;
  comments?: string;
}): Promise<ActionResult> {
  try {
    const gate = assertCanApproveContract({
      actorLabel: input.actor_label,
      actorRole: input.actor_role,
    });
    if (!gate.ok) return { ok: false, error: gate.reason };

    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (c.status !== "pending_approval") {
      return {
        ok: false,
        error: "Only contracts pending approval can be approved.",
      };
    }

    const { data: deps } = await supabase
      .from("deposits")
      .select("amount, status")
      .eq("contract_id", input.contract_id)
      .in("status", ["unearned", "applied"]);
    const received = (deps ?? []).reduce((s, d) => s + num(d.amount), 0);

    const slice = {
      status: c.status as string,
      deposit_required: Boolean(c.deposit_required),
      deposit_percent: num(c.deposit_percent),
      original_contract_value: num(
        c.original_contract_value ?? c.contract_value,
      ),
      contract_value: num(c.contract_value),
      minimum_deposit_amount: c.minimum_deposit_amount as number | null,
    };

    let next = statusAfterApproval({
      deposit_required: Boolean(c.deposit_required),
    });
    if (
      c.deposit_required &&
      isDepositSatisfied(slice, received)
    ) {
      next = statusAfterDepositSatisfied();
    }

    const now = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("contracts")
      .update({
        status: next,
        approved_at: now,
        approved_by: input.actor_label.trim(),
        terms_locked_at: now,
        activated_at: next === "active" ? now : null,
      })
      .eq("id", input.contract_id);
    if (uErr) throw uErr;

    await supabase.from("contract_approvals").insert({
      contract_id: input.contract_id,
      action: "approve",
      from_status: "pending_approval",
      to_status: next,
      actor_label: input.actor_label.trim(),
      actor_role: input.actor_role || "project_manager",
      comments:
        input.comments ||
        `Approved. Deposit required amount ${requiredDepositAmount(slice)}. Next status ${next}. Approval does not recognize revenue.`,
    });

    revalidateContracts(input.contract_id);
    return { ok: true, id: input.contract_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Approval failed.",
    };
  }
}

/**
 * After cash deposit is recorded, move deposit_pending → active when
 * required deposit amount is satisfied so Work may start.
 */
export async function tryActivateContractAfterDeposit(
  contractId: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .single();
    if (error) throw error;

    if (c.status !== "deposit_pending" && c.status !== "approved") {
      return { ok: true, id: contractId };
    }

    const { data: deps } = await supabase
      .from("deposits")
      .select("amount, status")
      .eq("contract_id", contractId)
      .in("status", ["unearned", "applied"]);
    const received = (deps ?? []).reduce((s, d) => s + num(d.amount), 0);

    const slice = {
      status: c.status as string,
      deposit_required: Boolean(c.deposit_required),
      deposit_percent: num(c.deposit_percent),
      original_contract_value: num(
        c.original_contract_value ?? c.contract_value,
      ),
      contract_value: num(c.contract_value),
      minimum_deposit_amount: c.minimum_deposit_amount as number | null,
      requires_deposit_before_work: c.requires_deposit_before_work as
        | boolean
        | null,
    };

    if (!isDepositSatisfied(slice, received)) {
      return { ok: true, id: contractId };
    }

    const next = statusAfterDepositSatisfied();
    const now = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("contracts")
      .update({
        status: next,
        activated_at: now,
      })
      .eq("id", contractId)
      .in("status", ["deposit_pending", "approved"]);
    if (uErr) throw uErr;

    await supabase.from("contract_approvals").insert({
      contract_id: contractId,
      action: "activate_after_deposit",
      from_status: c.status,
      to_status: next,
      actor_label: "System — deposit received",
      actor_role: "system",
      comments: `Deposit satisfied ($${received.toLocaleString()} of $${requiredDepositAmount(slice).toLocaleString()} required). Work may start.`,
    });

    revalidateContracts(contractId);
    return { ok: true, id: contractId };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Failed to activate contract after deposit.",
    };
  }
}

export async function rejectContract(input: {
  contract_id: string;
  actor_label: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    if (!input.reason?.trim())
      return { ok: false, error: "Rejection reason is required." };
    const gate = assertCanApproveContract({ actorLabel: input.actor_label });
    if (!gate.ok) return { ok: false, error: gate.reason };

    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("status")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (c.status !== "pending_approval") {
      return { ok: false, error: "Only pending contracts can be rejected." };
    }

    const { error: uErr } = await supabase
      .from("contracts")
      .update({
        status: "draft",
        submitted_at: null,
        submitted_by: null,
      })
      .eq("id", input.contract_id);
    if (uErr) throw uErr;

    await supabase.from("contract_approvals").insert({
      contract_id: input.contract_id,
      action: "reject",
      from_status: "pending_approval",
      to_status: "draft",
      actor_label: input.actor_label.trim(),
      actor_role: "project_manager",
      comments: input.reason.trim(),
    });

    revalidateContracts(input.contract_id);
    return { ok: true, id: input.contract_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reject failed.",
    };
  }
}

export async function returnContractToDraft(input: {
  contract_id: string;
  actor_label: string;
  comments: string;
}): Promise<ActionResult> {
  try {
    if (!input.comments?.trim())
      return { ok: false, error: "Comments are required when returning to draft." };
    const gate = assertCanApproveContract({ actorLabel: input.actor_label });
    if (!gate.ok) return { ok: false, error: gate.reason };

    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("status")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (c.status !== "pending_approval") {
      return {
        ok: false,
        error: "Only pending contracts can be returned to draft.",
      };
    }

    const { error: uErr } = await supabase
      .from("contracts")
      .update({
        status: "draft",
        submitted_at: null,
        submitted_by: null,
      })
      .eq("id", input.contract_id);
    if (uErr) throw uErr;

    await supabase.from("contract_approvals").insert({
      contract_id: input.contract_id,
      action: "request_changes",
      from_status: "pending_approval",
      to_status: "draft",
      actor_label: input.actor_label.trim(),
      actor_role: "project_manager",
      comments: input.comments.trim(),
    });

    revalidateContracts(input.contract_id);
    return { ok: true, id: input.contract_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Return failed.",
    };
  }
}

export async function createChangeOrder(input: {
  contract_id: string;
  description: string;
  price_change: number;
  scope_change_notes?: string;
  requested_by: string;
  reason_code?: string;
  accounting_treatment?: "prospective" | "cumulative_catchup";
  line_items?: {
    action: string;
    description: string;
    amount_change: number;
  }[];
}): Promise<ActionResult> {
  try {
    if (!input.description?.trim())
      return { ok: false, error: "Change order description is required." };
    if (!input.requested_by?.trim())
      return { ok: false, error: "Requested by is required." };

    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (["draft", "pending_approval", "canceled"].includes(c.status as string)) {
      return {
        ok: false,
        error: "Change orders require an approved / active contract lineage.",
      };
    }

    const { data: existing } = await supabase
      .from("contract_modifications")
      .select("mod_number")
      .eq("contract_id", input.contract_id)
      .order("mod_number", { ascending: false });
    let n = 1;
    if (existing?.length) {
      const last = String(existing[0].mod_number).replace(/\D/g, "");
      n = (Number(last) || existing.length) + 1;
    }
    const mod_number = `CO-${String(n).padStart(3, "0")}`;
    const prior = num(c.contract_value);
    const newVal = prior + num(input.price_change);

    const { data: mod, error: mErr } = await supabase
      .from("contract_modifications")
      .insert({
        contract_id: input.contract_id,
        mod_number,
        description: input.description.trim(),
        price_change: num(input.price_change),
        prior_contract_value: prior,
        new_contract_value: newVal,
        scope_change_notes: input.scope_change_notes || null,
        accounting_treatment: input.accounting_treatment || "prospective",
        status: "draft",
        requested_by: input.requested_by.trim(),
        reason_code: input.reason_code || null,
      })
      .select("id")
      .single();
    if (mErr) throw mErr;

    if (input.line_items?.length) {
      await supabase.from("contract_modification_line_items").insert(
        input.line_items.map((li, i) => ({
          modification_id: mod.id,
          contract_id: input.contract_id,
          action: li.action || "add",
          description: li.description,
          amount_change: num(li.amount_change),
          sort_order: i,
        })),
      );
    }

    await supabase.from("contract_audit_events").insert({
      contract_id: input.contract_id,
      event_type: "change_order_created",
      summary: `Change order ${mod_number} drafted (Δ ${input.price_change})`,
      actor_label: input.requested_by.trim(),
      payload: { mod_id: mod.id, mod_number, price_change: input.price_change },
    });

    revalidateContracts(input.contract_id);
    revalidatePath("/compliance/modifications");
    return { ok: true, id: mod.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Change order create failed.",
    };
  }
}

export async function approveChangeOrder(input: {
  modification_id: string;
  actor_label: string;
}): Promise<ActionResult> {
  try {
    const gate = assertCanApproveContract({ actorLabel: input.actor_label });
    if (!gate.ok) return { ok: false, error: gate.reason };

    const supabase = createClient();
    const { data: mod, error } = await supabase
      .from("contract_modifications")
      .select("*")
      .eq("id", input.modification_id)
      .single();
    if (error) throw error;
    if (mod.status !== "draft") {
      return { ok: false, error: "Only draft change orders can be approved." };
    }

    const { error: uErr } = await supabase
      .from("contract_modifications")
      .update({
        status: "approved",
        approved_by: input.actor_label.trim(),
        approved_at: new Date().toISOString(),
      })
      .eq("id", input.modification_id);
    if (uErr) throw uErr;

    await supabase.from("contract_audit_events").insert({
      contract_id: mod.contract_id,
      event_type: "change_order_approved",
      summary: `Change order ${mod.mod_number} commercially approved`,
      actor_label: input.actor_label.trim(),
      payload: { modification_id: mod.id },
    });

    revalidateContracts(mod.contract_id as string);
    revalidatePath("/compliance/modifications");
    return { ok: true, id: input.modification_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "CO approve failed.",
    };
  }
}

export async function closeContract(input: {
  contract_id: string;
  actor_label: string;
  closeout_notes: string;
}): Promise<ActionResult> {
  try {
    if (!input.actor_label?.trim())
      return { ok: false, error: "Closer name is required." };
    if (!input.closeout_notes?.trim())
      return { ok: false, error: "Closeout notes are required." };

    const { canClose, checks, contract } = await getCloseoutChecks(
      input.contract_id,
    );
    if (contract.status === "closed") {
      return { ok: false, error: "Contract is already closed." };
    }
    if (!canClose) {
      const failed = checks.filter((c) => !c.ok).map((c) => c.label);
      return {
        ok: false,
        error: `Closeout blocked: ${failed.join("; ")}`,
      };
    }

    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("contracts")
      .update({
        status: "closed",
        closed_at: now,
        completed_at: contract.completed_at || now,
        performance_complete: true,
        closeout_notes: input.closeout_notes.trim(),
      })
      .eq("id", input.contract_id);
    if (error) throw error;

    await supabase.from("contract_audit_events").insert({
      contract_id: input.contract_id,
      event_type: "contract_closed",
      summary: "Contract closed out",
      actor_label: input.actor_label.trim(),
      from_status: contract.status,
      to_status: "closed",
      payload: { closeout_notes: input.closeout_notes.trim() },
    });

    revalidateContracts(input.contract_id);
    return { ok: true, id: input.contract_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Closeout failed.",
    };
  }
}

export async function markPerformanceComplete(input: {
  contract_id: string;
  actor_label: string;
}): Promise<ActionResult> {
  try {
    if (!input.actor_label?.trim())
      return { ok: false, error: "Actor is required." };
    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("status")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (!["active", "completed"].includes(c.status as string)) {
      return {
        ok: false,
        error: "Performance can only be completed on active contracts.",
      };
    }
    const now = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("contracts")
      .update({
        performance_complete: true,
        status: "completed",
        completed_at: now,
      })
      .eq("id", input.contract_id);
    if (uErr) throw uErr;

    await supabase.from("contract_audit_events").insert({
      contract_id: input.contract_id,
      event_type: "performance_complete",
      summary: "Marked performance complete — does not recognize revenue by itself",
      actor_label: input.actor_label.trim(),
      from_status: c.status as string,
      to_status: "completed",
    });

    revalidateContracts(input.contract_id);
    return { ok: true, id: input.contract_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed.",
    };
  }
}

export async function addContractDocument(input: {
  contract_id: string;
  title: string;
  doc_type: string;
  external_url?: string;
  uploaded_by: string;
}): Promise<ActionResult> {
  try {
    if (!input.title?.trim()) return { ok: false, error: "Title is required." };
    if (!input.uploaded_by?.trim())
      return { ok: false, error: "Uploader is required." };
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contract_documents")
      .insert({
        contract_id: input.contract_id,
        title: input.title.trim(),
        doc_type: input.doc_type || "other",
        external_url: input.external_url || null,
        uploaded_by: input.uploaded_by.trim(),
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("contract_audit_events").insert({
      contract_id: input.contract_id,
      event_type: "document_added",
      summary: `Document added: ${input.title.trim()}`,
      actor_label: input.uploaded_by.trim(),
    });

    revalidateContracts(input.contract_id);
    return { ok: true, id: data.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Document add failed.",
    };
  }
}
