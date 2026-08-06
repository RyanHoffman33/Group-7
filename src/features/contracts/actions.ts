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
  involvement_model?: string;
  custom_checkpoint_types?: string[];
  /** ASC 606 commercial POs (amounts must sum to contract_value). */
  performance_obligations?: {
    title: string;
    description?: string;
    completion_definition: string;
    amount: number;
    /** Stable service line keys covered by this PO. */
    service_keys?: string[];
  }[];
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

    const { DEMO_CUSTOMER_ID, DEMO_CUSTOMER_ORG } = await import(
      "@/features/involvement/queries"
    );
    let customerIsDemoPortal = input.customer_id === DEMO_CUSTOMER_ID;
    if (!customerIsDemoPortal) {
      const { data: custRow } = await supabase
        .from("customers")
        .select("id, name")
        .eq("id", input.customer_id)
        .maybeSingle();
      const custName = String(custRow?.name ?? "").trim().toLowerCase();
      customerIsDemoPortal =
        custName === DEMO_CUSTOMER_ORG.toLowerCase() ||
        input.customer_id === "11111111-1111-1111-1111-111111111108";
    }

    const status = input.submit_for_approval
      ? customerIsDemoPortal
        ? "pending_customer_acceptance"
        : "pending_approval"
      : "draft";
    const involvementModel =
      input.involvement_model === "full_service" ||
      input.involvement_model === "custom" ||
      input.involvement_model === "collaborative"
        ? input.involvement_model
        : "collaborative";

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
        billing_method: "milestone",
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
        involvement_model: involvementModel,
        submitted_at: input.submit_for_approval ? new Date().toISOString() : null,
        submitted_by: input.submit_for_approval ? input.created_by : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const id = contract.id as string;

    if (involvementModel === "custom" && input.custom_checkpoint_types?.length) {
      const types = input.custom_checkpoint_types.filter(Boolean);
      if (types.length) {
        await supabase.from("contract_involvement_checkpoints").insert(
          types.map((checkpoint_type) => ({
            contract_id: id,
            checkpoint_type,
            required: true,
          })),
        );
      }
    }

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

    if (input.performance_obligations?.length) {
      const poSum = input.performance_obligations.reduce(
        (s, p) => s + num(p.amount),
        0,
      );
      if (Math.abs(poSum - net) > 0.01) {
        return {
          ok: false,
          error: `Performance obligation amounts ($${poSum.toFixed(2)}) must equal net contract value ($${net.toFixed(2)}).`,
        };
      }
      for (const p of input.performance_obligations) {
        if (!p.title?.trim() || !p.completion_definition?.trim()) {
          return {
            ok: false,
            error: "Each performance obligation needs a title and completion criteria.",
          };
        }
      }
      const { error: poErr } = await supabase
        .from("contract_performance_obligations")
        .insert(
          input.performance_obligations.map((p, i) => ({
            contract_id: id,
            seq: i + 1,
            title: p.title.trim(),
            description: p.description?.trim() || null,
            completion_definition: p.completion_definition.trim(),
            amount: num(p.amount),
            service_keys: Array.isArray(p.service_keys)
              ? p.service_keys.map(String).filter(Boolean)
              : [],
            status: "draft",
          })),
        );
      if (poErr) throw poErr;
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
        to_status: status,
        actor_label: input.created_by,
        actor_role: "coordinator",
        comments: customerIsDemoPortal
          ? "Submitted to customer for acceptance"
          : "Submitted via create contract workflow",
      });
    }

    revalidateContracts(id);
    if (customerIsDemoPortal && input.submit_for_approval) {
      revalidatePath("/dashboard/customer");
      revalidatePath("/dashboard/customer/proposals");
    }
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

async function nextCancelInvoiceNumber(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  let seq = 1;
  if (data?.[0]?.invoice_number) {
    const part = String(data[0].invoice_number).split("-").pop();
    seq = (Number(part) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Mid-stream cancellation: amounts paid thus far are recognized as revenue,
 * incomplete POs are cancelled, and the contract is terminated.
 */
export async function cancelContract(input: {
  contract_id: string;
  actor_label: string;
  cancel_reason: string;
}): Promise<ActionResult> {
  try {
    if (!input.actor_label?.trim())
      return { ok: false, error: "Actor is required." };
    if (!input.cancel_reason?.trim())
      return { ok: false, error: "A cancellation reason is required." };

    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (c.status === "canceled") {
      return { ok: false, error: "Contract is already canceled." };
    }
    if (c.status === "closed") {
      return { ok: false, error: "Closed contracts cannot be canceled." };
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const customerId = c.customer_id as string;

    const { data: unearnedDeps } = await supabase
      .from("deposits")
      .select("id, amount, status")
      .eq("contract_id", input.contract_id)
      .eq("status", "unearned");
    const unearnedTotal = (unearnedDeps ?? []).reduce(
      (s, d) => s + num(d.amount),
      0,
    );

    // Recognize paid-but-deferred invoices (cash collected already).
    const { data: deferredInvs } = await supabase
      .from("invoices")
      .select("id, status, recognition_status, total")
      .eq("contract_id", input.contract_id)
      .eq("recognition_status", "deferred")
      .in("status", ["paid", "partially_paid"]);
    if (deferredInvs?.length) {
      await supabase
        .from("invoices")
        .update({ recognition_status: "recognized" })
        .in(
          "id",
          deferredInvs.map((i) => i.id as string),
        );
      for (const inv of deferredInvs) {
        await supabase.from("ar_ledger_entries").insert({
          invoice_id: inv.id,
          entry_type: "revenue_recognize",
          debit: 0,
          credit: num(inv.total),
          memo: "Cancellation — recognize amounts paid to date",
        });
        await supabase.from("recognition_evidence").insert({
          contract_id: input.contract_id,
          invoice_id: inv.id,
          evidence_type: "other",
          evidence_date: today,
          description:
            "Contract cancellation — paid invoice amounts recognized as revenue",
          supporting_ref: `cancel:${input.contract_id}`,
          created_by: input.actor_label.trim(),
        });
      }
    }

    // Unearned deposits (cash held) → recognize via cancellation invoice.
    if (unearnedTotal > 0.009) {
      const invoiceNumber = await nextCancelInvoiceNumber(supabase);
      const { data: inv, error: iErr } = await supabase
        .from("invoices")
        .insert({
          contract_id: input.contract_id,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          issue_date: today,
          due_date: today,
          subtotal: unearnedTotal,
          tax: 0,
          total: unearnedTotal,
          status: "paid",
          recognition_status: "recognized",
          billing_method: c.billing_method || "milestone",
          milestone_key: `cancel-${input.contract_id.slice(0, 8)}`,
          created_by: input.actor_label.trim(),
        })
        .select("id")
        .single();
      if (iErr) throw iErr;

      await supabase.from("invoice_lines").insert({
        invoice_id: inv.id,
        description:
          "Cancellation — amounts paid to date recognized as revenue",
        quantity: 1,
        unit_rate: unearnedTotal,
        amount: unearnedTotal,
        performance_obligation_ref: "cancellation",
      });

      const { data: payment, error: pErr } = await supabase
        .from("payments")
        .insert({
          customer_id: customerId,
          amount: unearnedTotal,
          paid_at: today,
          method: "deposit_apply",
          reference: `CANCEL-${input.contract_id.slice(0, 8)}`,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      await supabase.from("payment_applications").insert({
        payment_id: payment.id,
        invoice_id: inv.id,
        amount: unearnedTotal,
      });

      for (const d of unearnedDeps ?? []) {
        await supabase
          .from("deposits")
          .update({
            status: "applied",
            applied_to_invoice_id: inv.id,
          })
          .eq("id", d.id);
      }

      await supabase.from("ar_ledger_entries").insert({
        invoice_id: inv.id,
        entry_type: "revenue_recognize",
        debit: 0,
        credit: unearnedTotal,
        memo: "Cancellation — unearned deposits recognized as revenue",
      });

      await supabase.from("recognition_evidence").insert({
        contract_id: input.contract_id,
        invoice_id: inv.id,
        evidence_type: "other",
        evidence_date: today,
        description: `Contract canceled. $${unearnedTotal.toFixed(2)} paid to date recognized as revenue; contract terminated.`,
        supporting_ref: `cancel:${input.contract_id}`,
        created_by: input.actor_label.trim(),
      });
    } else {
      await supabase.from("recognition_evidence").insert({
        contract_id: input.contract_id,
        evidence_type: "other",
        evidence_date: today,
        description: `Contract canceled with no unearned deposits to recognize. Reason: ${input.cancel_reason.trim()}`,
        supporting_ref: `cancel:${input.contract_id}`,
        created_by: input.actor_label.trim(),
      });
    }

    // Incomplete POs → cancelled
    await supabase
      .from("contract_performance_obligations")
      .update({ status: "cancelled", updated_at: now })
      .eq("contract_id", input.contract_id)
      .neq("status", "completed");

    const { error: uErr } = await supabase
      .from("contracts")
      .update({
        status: "canceled",
        canceled_at: now,
        cancel_reason: input.cancel_reason.trim(),
        canceled_by: input.actor_label.trim(),
      })
      .eq("id", input.contract_id);
    if (uErr) throw uErr;

    await supabase.from("contract_audit_events").insert({
      contract_id: input.contract_id,
      event_type: "contract_canceled",
      summary: `Contract canceled — paid amounts recognized; ${input.cancel_reason.trim()}`,
      actor_label: input.actor_label.trim(),
      from_status: c.status as string,
      to_status: "canceled",
      payload: {
        cancel_reason: input.cancel_reason.trim(),
        unearned_recognized: unearnedTotal,
      },
    });

    revalidateContracts(input.contract_id);
    revalidatePath("/compliance");
    revalidatePath("/compliance/recognition");
    revalidatePath("/billing/invoices");
    revalidatePath("/billing/deposits");
    revalidatePath("/dashboard/customer");
    return { ok: true, id: input.contract_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Cancellation failed.",
    };
  }
}

/**
 * Customer accepts a pending_customer_acceptance (or legacy draft/pending_approval)
 * proposal: typed sign + deposit (= PO1 / required deposit) → active or deposit_pending.
 */
export async function customerAcceptContractProposal(input: {
  contract_id: string;
  signer_name: string;
  pay_deposit: boolean;
}): Promise<ActionResult> {
  try {
    const { getSessionUser } = await import("@/features/users/session");
    const {
      resolveCustomerIdForPortalSession,
    } = await import("@/features/involvement/queries");
    const session = await getSessionUser();
    if (!session || session.roleKey !== "customer") {
      return { ok: false, error: "Customer sign-in required." };
    }
    if (!input.signer_name?.trim() || input.signer_name.trim().length < 2) {
      return { ok: false, error: "Type your full legal name to sign." };
    }
    if (!input.pay_deposit) {
      return {
        ok: false,
        error: "You must authorize the deposit (PO #1) to accept.",
      };
    }

    const customerId = await resolveCustomerIdForPortalSession({
      organization: session.organization,
      email: session.email,
    });
    if (!customerId) {
      return { ok: false, error: "No customer record linked to this account." };
    }

    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (c.customer_id !== customerId) {
      return { ok: false, error: "Proposal not found for your account." };
    }
    const openForAccept = [
      "pending_customer_acceptance",
      "draft",
      "pending_approval",
    ];
    if (!openForAccept.includes(c.status as string)) {
      return {
        ok: false,
        error: "This proposal is not open for acceptance.",
      };
    }

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
    const depositAmount = requiredDepositAmount(slice);
    if (depositAmount <= 0) {
      return {
        ok: false,
        error: "Proposal has no deposit amount — contact your project manager.",
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // Prefer linking deposit to first PO when present
    const { data: firstPo } = await supabase
      .from("contract_performance_obligations")
      .select("id, amount, seq")
      .eq("contract_id", input.contract_id)
      .order("seq", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: dep, error: dErr } = await supabase
      .from("deposits")
      .insert({
        contract_id: input.contract_id,
        customer_id: customerId,
        amount: depositAmount,
        received_at: today,
        status: "unearned",
        performance_obligation_id: firstPo?.id ?? null,
      })
      .select("id")
      .single();
    if (dErr) throw dErr;

    if (firstPo?.id) {
      await supabase
        .from("contract_performance_obligations")
        .update({
          installment_deposit_id: dep.id,
          status: "active",
          updated_at: now,
        })
        .eq("id", firstPo.id);
    }

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: null,
      entry_type: "deposit_receive",
      debit: depositAmount,
      credit: 0,
      memo: `Customer accepted proposal — deposit (PO #1) for ${c.event_name}`,
    });

    const nextStatus = isDepositSatisfied(slice, depositAmount)
      ? statusAfterDepositSatisfied()
      : statusAfterApproval({ deposit_required: Boolean(c.deposit_required) });

    const { error: uErr } = await supabase
      .from("contracts")
      .update({
        status: nextStatus,
        approved_at: now,
        approved_by: input.signer_name.trim(),
        activated_at: nextStatus === "active" ? now : null,
        terms_locked_at: now,
        notes: c.notes
          ? `${c.notes}\n\nCustomer signed: ${input.signer_name.trim()} on ${today}.`
          : `Customer signed: ${input.signer_name.trim()} on ${today}.`,
      })
      .eq("id", input.contract_id);
    if (uErr) throw uErr;

    await supabase.from("contract_approvals").insert({
      contract_id: input.contract_id,
      action: "approve",
      from_status: c.status as string,
      to_status: nextStatus,
      actor_label: input.signer_name.trim(),
      actor_role: "customer",
      comments: `Customer accepted proposal with deposit $${depositAmount.toFixed(2)}. Signatory: ${input.signer_name.trim()}.`,
    });

    await supabase.from("contract_audit_events").insert({
      contract_id: input.contract_id,
      event_type: "customer_accepted_proposal",
      summary: `Customer accepted proposal; deposit $${depositAmount.toFixed(2)} recorded`,
      actor_label: input.signer_name.trim(),
      from_status: c.status as string,
      to_status: nextStatus,
      payload: { deposit_id: dep.id, deposit_amount: depositAmount },
    });

    revalidateContracts(input.contract_id);
    revalidatePath("/dashboard/customer");
    revalidatePath("/dashboard/customer/actions");
    revalidatePath("/dashboard/customer/engagement");
    revalidatePath("/dashboard/customer/proposals");
    return { ok: true, id: input.contract_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Accept failed.",
    };
  }
}

export async function customerRejectContractProposal(input: {
  contract_id: string;
  reason?: string;
}): Promise<ActionResult> {
  try {
    const { getSessionUser } = await import("@/features/users/session");
    const {
      resolveCustomerIdForPortalSession,
    } = await import("@/features/involvement/queries");
    const session = await getSessionUser();
    if (!session || session.roleKey !== "customer") {
      return { ok: false, error: "Customer sign-in required." };
    }

    const customerId = await resolveCustomerIdForPortalSession({
      organization: session.organization,
      email: session.email,
    });
    if (!customerId) {
      return { ok: false, error: "No customer record linked to this account." };
    }

    const reason =
      input.reason?.trim() || "Customer declined the contract proposal.";

    const supabase = createClient();
    const { data: c, error } = await supabase
      .from("contracts")
      .select("id, customer_id, status, event_name")
      .eq("id", input.contract_id)
      .single();
    if (error) throw error;
    if (c.customer_id !== customerId) {
      return { ok: false, error: "Proposal not found for your account." };
    }
    const openForReject = [
      "pending_customer_acceptance",
      "draft",
      "pending_approval",
    ];
    if (!openForReject.includes(c.status as string)) {
      return { ok: false, error: "This proposal cannot be rejected now." };
    }

    return cancelContract({
      contract_id: input.contract_id,
      actor_label: session.fullName,
      cancel_reason: reason,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reject failed.",
    };
  }
}
