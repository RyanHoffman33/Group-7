"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  APPROVAL_THRESHOLD,
  DEFAULT_LABOR_RATE,
  type CostCategory,
} from "@/features/costs/config";
import { computeCommitmentFlags, hasAnyFlag } from "@/features/costs/flags";
import {
  contractHasIssuedInvoice,
  getBudgetVsActual,
  getContractForCosts,
  listCostEntries,
} from "@/features/costs/queries";
import type {
  CostApprovalStatus,
  CostCommitmentStatus,
  CostEntryType,
  CostHistoryAction,
} from "@/lib/supabase/types";

function revalidateCosts(contractId?: string, entryId?: string) {
  revalidatePath("/costs");
  revalidatePath("/costs/approvals");
  revalidatePath("/costs/commitments");
  revalidatePath("/costs/flags");
  revalidatePath("/costs/reports");
  revalidatePath("/costs/time");
  revalidatePath("/costs/expenses");
  if (contractId) revalidatePath(`/costs/events/${contractId}`);
  if (entryId) revalidatePath(`/costs/entries/${entryId}`);
  revalidatePath("/compliance/costs");
}

async function logHistory(input: {
  costEntryId: string;
  action: CostHistoryAction;
  actor: string;
  detail?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const supabase = createClient();
  await supabase.from("cost_entry_history").insert({
    cost_entry_id: input.costEntryId,
    action: input.action,
    actor: input.actor,
    detail: input.detail ?? null,
    before_snapshot: input.before ?? null,
    after_snapshot: input.after ?? null,
  });
}

function snapshotRow(row: Record<string, unknown>) {
  return {
    amount: row.amount,
    commitment_status: row.commitment_status,
    approval_status: row.approval_status,
    category: row.category,
    notes: row.notes,
    invoice_ref: row.invoice_ref,
    hours: row.hours,
    rate: row.rate,
    prior_committed_amount: row.prior_committed_amount,
  };
}

async function detectFlags(input: {
  contractId: string;
  category: CostCategory;
  amount: number;
  commitmentStatus: CostCommitmentStatus;
  vendorId: string | null;
  vendorName: string | null;
  invoiceRef: string | null;
  excludeId?: string;
}) {
  const contract = await getContractForCosts(input.contractId);
  const billed = await contractHasIssuedInvoice(input.contractId);
  const existing = await listCostEntries({ contractId: input.contractId });

  let flag_duplicate_invoice = false;
  if (input.invoiceRef && input.invoiceRef.trim()) {
    flag_duplicate_invoice = existing.some(
      (e) =>
        e.id !== input.excludeId &&
        e.invoice_ref &&
        e.invoice_ref.trim().toLowerCase() ===
          input.invoiceRef!.trim().toLowerCase() &&
        ((input.vendorId && e.vendor_id === input.vendorId) ||
          (input.vendorName &&
            e.vendor_name?.toLowerCase() === input.vendorName.toLowerCase())),
    );
  }

  const budgetRows = await getBudgetVsActual(input.contractId);
  const catRow = budgetRows.find((r) => r.category === input.category);
  const othersSpent = existing
    .filter(
      (e) => e.category === input.category && e.id !== input.excludeId,
    )
    .reduce((s, e) => s + e.amount, 0);
  const flag_over_committed =
    (catRow?.budgeted ?? 0) > 0 &&
    othersSpent + input.amount > (catRow?.budgeted ?? 0);

  const flag_after_billing = Boolean(
    contract?.performance_complete || billed,
  );
  const flag_late_entry = flag_after_billing;

  return {
    flag_duplicate_invoice,
    flag_over_committed,
    flag_after_billing,
    flag_late_entry,
  };
}

function approvalForAmount(amount: number): CostApprovalStatus {
  return amount >= APPROVAL_THRESHOLD ? "pending_approval" : "not_required";
}

export async function createTimeEntry(input: {
  contract_id: string;
  worker_label: string;
  hours: number;
  rate?: number;
  incurred_date: string;
  notes?: string;
  entered_by?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const hours = Number(input.hours);
    const rate = Number(input.rate ?? DEFAULT_LABOR_RATE);
    if (!input.contract_id) return { ok: false, error: "Select an event." };
    if (!input.worker_label?.trim())
      return { ok: false, error: "Enter who worked." };
    if (!(hours > 0)) return { ok: false, error: "Hours must be greater than 0." };
    if (!(rate >= 0)) return { ok: false, error: "Rate must be valid." };

    const amount = Math.round(hours * rate * 100) / 100;
    const flags = await detectFlags({
      contractId: input.contract_id,
      category: "labor",
      amount,
      commitmentStatus: "actual",
      vendorId: null,
      vendorName: null,
      invoiceRef: null,
    });
    const commitmentFlags = computeCommitmentFlags({
      commitmentStatus: "actual",
      amount,
      priorCommittedAmount: null,
    });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("cost_entries")
      .insert({
        contract_id: input.contract_id,
        entry_type: "labor" satisfies CostEntryType,
        category: "labor",
        amount,
        hours,
        rate,
        worker_label: input.worker_label.trim(),
        commitment_status: "actual",
        approval_status: approvalForAmount(amount),
        is_reimbursable: false,
        notes: input.notes?.trim() || null,
        entered_by: input.entered_by?.trim() || input.worker_label.trim(),
        incurred_date: input.incurred_date,
        ...flags,
        ...commitmentFlags,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    const actor = input.entered_by?.trim() || input.worker_label.trim();
    await logHistory({
      costEntryId: data.id as string,
      action: "created",
      actor,
      detail: "Labor time entry created",
      after: { amount, hours, rate, commitment_status: "actual", category: "labor" },
    });

    revalidateCosts(input.contract_id, data.id);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Form-action wrapper: redirects to the new entry on success. */
export async function createTimeEntryAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const { getSessionUser } = await import("@/features/users/session");
  const session = await getSessionUser();
  const worker =
    session?.fullName?.trim() ||
    String(formData.get("worker_label") ?? "").trim();
  const result = await createTimeEntry({
    contract_id: String(formData.get("contract_id") ?? ""),
    worker_label: worker,
    hours: Number(formData.get("hours")),
    rate: Number(formData.get("rate")),
    incurred_date: String(formData.get("incurred_date") ?? ""),
    notes: String(formData.get("notes") || ""),
    entered_by: worker,
  });
  if (!result.ok) return { error: result.error ?? "Failed to log time." };
  if (!result.id) return { error: "Saved, but no entry id was returned." };
  redirect(`/costs/entries/${result.id}`);
}

export async function createExpenseEntry(input: {
  contract_id: string;
  category: CostCategory;
  amount: number;
  vendor_id?: string;
  vendor_name?: string;
  invoice_ref?: string;
  commitment_status: CostCommitmentStatus;
  is_reimbursable?: boolean;
  notes?: string;
  entered_by?: string;
  incurred_date: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const amount = Number(input.amount);
    if (!input.contract_id) return { ok: false, error: "Select an event." };
    if (!(amount > 0)) return { ok: false, error: "Amount must be greater than 0." };
    if (!input.category) return { ok: false, error: "Select a category." };

    let vendorName = input.vendor_name?.trim() || null;
    if (input.vendor_id) {
      const supabaseLookup = createClient();
      const { data: vendor } = await supabaseLookup
        .from("vendors")
        .select("name")
        .eq("id", input.vendor_id)
        .maybeSingle();
      if (vendor?.name) vendorName = vendor.name as string;
    }
    if (!vendorName) return { ok: false, error: "Select or enter a vendor / payee." };

    const isReimbursable =
      input.category === "reimbursable" || Boolean(input.is_reimbursable);

    const flags = await detectFlags({
      contractId: input.contract_id,
      category: input.category,
      amount,
      commitmentStatus: input.commitment_status,
      vendorId: input.vendor_id ?? null,
      vendorName,
      invoiceRef: input.invoice_ref ?? null,
    });
    const prior =
      input.commitment_status === "committed" ? amount : null;
    const commitmentFlags = computeCommitmentFlags({
      commitmentStatus: input.commitment_status,
      amount,
      priorCommittedAmount: prior,
    });

    const supabase = createClient();
    const { data, error } = await supabase
      .from("cost_entries")
      .insert({
        contract_id: input.contract_id,
        entry_type: "vendor_expense" satisfies CostEntryType,
        category: input.category,
        amount,
        vendor_id: input.vendor_id || null,
        vendor_name: vendorName,
        invoice_ref: input.invoice_ref?.trim() || null,
        commitment_status: input.commitment_status,
        approval_status: approvalForAmount(amount),
        is_reimbursable: isReimbursable,
        notes: input.notes?.trim() || null,
        entered_by: input.entered_by?.trim() || "coordinator",
        incurred_date: input.incurred_date,
        prior_committed_amount: prior,
        ...flags,
        ...commitmentFlags,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    const actor = input.entered_by?.trim() || "coordinator";
    await logHistory({
      costEntryId: data.id as string,
      action: "created",
      actor,
      detail: `Expense created (${input.commitment_status})`,
      after: {
        amount,
        commitment_status: input.commitment_status,
        category: input.category,
        vendor_name: vendorName,
      },
    });

    revalidateCosts(input.contract_id, data.id);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateCostEntry(input: {
  id: string;
  notes?: string;
  commitment_status?: CostCommitmentStatus;
  amount?: number;
  hours?: number;
  rate?: number;
  invoice_ref?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data: existing, error: loadErr } = await supabase
      .from("cost_entries")
      .select("*")
      .eq("id", input.id)
      .maybeSingle();
    if (loadErr) return { ok: false, error: loadErr.message };
    if (!existing) return { ok: false, error: "Cost entry not found." };

    const patch: Record<string, unknown> = {};
    if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
    if (input.commitment_status)
      patch.commitment_status = input.commitment_status;
    if (input.invoice_ref !== undefined)
      patch.invoice_ref = input.invoice_ref.trim() || null;

    let amount = Number(existing.amount);
    if (existing.entry_type === "labor") {
      const hours =
        input.hours !== undefined ? Number(input.hours) : Number(existing.hours);
      const rate =
        input.rate !== undefined ? Number(input.rate) : Number(existing.rate);
      if (!(hours > 0)) return { ok: false, error: "Hours must be > 0." };
      amount = Math.round(hours * rate * 100) / 100;
      patch.hours = hours;
      patch.rate = rate;
      patch.amount = amount;
    } else if (input.amount !== undefined) {
      amount = Number(input.amount);
      if (!(amount > 0)) return { ok: false, error: "Amount must be > 0." };
      patch.amount = amount;
    }

    if (
      existing.approval_status === "not_required" ||
      existing.approval_status === "pending_approval"
    ) {
      patch.approval_status = approvalForAmount(amount);
    }

    const flags = await detectFlags({
      contractId: existing.contract_id as string,
      category: existing.category as CostCategory,
      amount,
      commitmentStatus: (input.commitment_status ??
        existing.commitment_status) as CostCommitmentStatus,
      vendorId: (existing.vendor_id as string | null) ?? null,
      vendorName: (existing.vendor_name as string | null) ?? null,
      invoiceRef:
        input.invoice_ref !== undefined
          ? input.invoice_ref
          : ((existing.invoice_ref as string | null) ?? null),
      excludeId: input.id,
    });
    Object.assign(patch, flags);

    const nextStatus = (input.commitment_status ??
      existing.commitment_status) as CostCommitmentStatus;
    let priorCommitted =
      existing.prior_committed_amount == null
        ? null
        : Number(existing.prior_committed_amount);
    if (nextStatus === "committed") {
      priorCommitted = amount;
      patch.prior_committed_amount = amount;
    }
    Object.assign(
      patch,
      computeCommitmentFlags({
        commitmentStatus: nextStatus,
        amount,
        priorCommittedAmount: priorCommitted,
      }),
    );

    const before = snapshotRow(existing as Record<string, unknown>);
    const { error } = await supabase
      .from("cost_entries")
      .update(patch)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };

    await logHistory({
      costEntryId: input.id,
      action: "updated",
      actor: "finance.user",
      detail: "Cost entry edited",
      before,
      after: { ...before, ...patch },
    });

    revalidateCosts(existing.contract_id as string, input.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function approveCostEntry(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error: loadErr } = await supabase
      .from("cost_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) return { ok: false, error: loadErr.message };
    if (!data) return { ok: false, error: "Not found." };
    if (data.approval_status !== "pending_approval")
      return { ok: false, error: "Entry is not pending approval." };

    const { error } = await supabase
      .from("cost_entries")
      .update({ approval_status: "approved" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    await logHistory({
      costEntryId: id,
      action: "approved",
      actor: "manager",
      detail: "Cost approved",
      before: snapshotRow(data as Record<string, unknown>),
      after: { approval_status: "approved" },
    });

    revalidateCosts(data.contract_id as string, id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function rejectCostEntry(
  id: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const rejectionReason = reason?.trim();
    if (!rejectionReason) {
      return { ok: false, error: "A rejection reason is required." };
    }
    const supabase = createClient();
    const { data, error: loadErr } = await supabase
      .from("cost_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) return { ok: false, error: loadErr.message };
    if (!data) return { ok: false, error: "Not found." };
    if (data.approval_status !== "pending_approval")
      return { ok: false, error: "Entry is not pending approval." };

    const priorNotes = String(data.notes ?? "").trim();
    const notes = priorNotes
      ? `${priorNotes}\nRejected: ${rejectionReason}`
      : `Rejected: ${rejectionReason}`;

    const { error } = await supabase
      .from("cost_entries")
      .update({ approval_status: "rejected", notes })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    await logHistory({
      costEntryId: id,
      action: "rejected",
      actor: "manager",
      detail: `Cost rejected: ${rejectionReason}`,
      before: snapshotRow(data as Record<string, unknown>),
      after: { approval_status: "rejected", notes },
    });

    revalidateCosts(data.contract_id as string, id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/**
 * Mark control flags as resolved without clearing boolean flag columns
 * (audit trail preserved). Mirrors billing acknowledgeAlert pattern.
 */
export async function resolveCostFlags(
  id: string,
  opts?: { note?: string; actorLabel?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error: loadErr } = await supabase
      .from("cost_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) return { ok: false, error: loadErr.message };
    if (!data) return { ok: false, error: "Cost entry not found." };

    const flagSnapshot = {
      flag_late_entry: Boolean(data.flag_late_entry),
      flag_duplicate_invoice: Boolean(data.flag_duplicate_invoice),
      flag_over_committed: Boolean(data.flag_over_committed),
      flag_after_billing: Boolean(data.flag_after_billing),
      flag_actual_exceeds_committed: Boolean(data.flag_actual_exceeds_committed),
      flag_no_commitment: Boolean(data.flag_no_commitment),
      amount: Number(data.amount),
      commitment_status: data.commitment_status as CostCommitmentStatus,
      prior_committed_amount:
        data.prior_committed_amount == null
          ? null
          : Number(data.prior_committed_amount),
      flags_resolved_at: (data.flags_resolved_at as string | null) ?? null,
      approval_status: data.approval_status as CostApprovalStatus,
    };

    if (!hasAnyFlag(flagSnapshot))
      return { ok: false, error: "Entry has no flags to resolve." };
    if (flagSnapshot.flags_resolved_at)
      return { ok: false, error: "Flags are already resolved." };

    const actor = opts?.actorLabel?.trim() || "finance.user";
    const note = opts?.note?.trim() || null;
    const resolvedAt = new Date().toISOString();
    const patch = {
      flags_resolved_at: resolvedAt,
      flags_resolved_by: actor,
      flags_resolution_note: note,
    };

    const { error } = await supabase
      .from("cost_entries")
      .update(patch)
      .eq("id", id);

    if (error) {
      // Live DB may lack flags_resolved_* columns — use overlay + history fallback.
      const { setFlagResolutionOverlay } = await import(
        "@/features/costs/flag-resolution-overlay"
      );
      setFlagResolutionOverlay(id, {
        flags_resolved_at: resolvedAt,
        flags_resolved_by: actor,
        flags_resolution_note: note,
      });
      await logHistory({
        costEntryId: id,
        action: "updated",
        actor,
        detail: note
          ? `Flags resolved (demo overlay): ${note}`
          : "Control flags marked resolved (demo overlay — apply cost_flags_resolution migration for durable columns)",
        before: snapshotRow(data as Record<string, unknown>),
        after: patch,
      });
      revalidateCosts(data.contract_id as string, id);
      return { ok: true };
    }

    try {
      await logHistory({
        costEntryId: id,
        action: "flags_resolved",
        actor,
        detail: note ?? "Control flags marked resolved",
        before: snapshotRow(data as Record<string, unknown>),
        after: patch,
      });
    } catch {
      await logHistory({
        costEntryId: id,
        action: "updated",
        actor,
        detail: note ?? "Control flags marked resolved",
        before: snapshotRow(data as Record<string, unknown>),
        after: patch,
      });
    }

    revalidateCosts(data.contract_id as string, id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function actualizeCostEntry(input: {
  id: string;
  actual_amount?: number;
  actor?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data: existing, error: loadErr } = await supabase
      .from("cost_entries")
      .select("*")
      .eq("id", input.id)
      .maybeSingle();
    if (loadErr) return { ok: false, error: loadErr.message };
    if (!existing) return { ok: false, error: "Not found." };
    if (existing.commitment_status !== "committed")
      return { ok: false, error: "Only committed costs can be recorded as actual." };
    if (existing.approval_status === "pending_approval") {
      return {
        ok: false,
        error:
          "This commitment is waiting for approval. Approve it first, then record the actual cost.",
      };
    }
    if (existing.approval_status === "rejected") {
      return {
        ok: false,
        error: "This commitment was rejected and cannot be recorded as actual cost.",
      };
    }

    const prior =
      existing.prior_committed_amount != null
        ? Number(existing.prior_committed_amount)
        : Number(existing.amount);
    const actualAmount =
      input.actual_amount !== undefined
        ? Number(input.actual_amount)
        : Number(existing.amount);
    if (!(actualAmount > 0))
      return { ok: false, error: "Actual amount must be greater than 0." };

    const commitmentFlags = computeCommitmentFlags({
      commitmentStatus: "actual",
      amount: actualAmount,
      priorCommittedAmount: prior,
    });
    const patch = {
      commitment_status: "actual" as const,
      amount: actualAmount,
      prior_committed_amount: prior,
      ...commitmentFlags,
      approval_status:
        existing.approval_status === "approved" ||
        existing.approval_status === "rejected"
          ? existing.approval_status
          : approvalForAmount(actualAmount),
    };

    const { error } = await supabase
      .from("cost_entries")
      .update(patch)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };

    const actor = input.actor?.trim() || "finance.user";
    await logHistory({
      costEntryId: input.id,
      action: "actualized",
      actor,
      detail: commitmentFlags.flag_actual_exceeds_committed
        ? `Actualized; actual $${actualAmount} exceeds variance limit vs committed $${prior}`
        : `Actualized at $${actualAmount} (committed $${prior})`,
      before: snapshotRow(existing as Record<string, unknown>),
      after: patch,
    });

    revalidateCosts(existing.contract_id as string, input.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}