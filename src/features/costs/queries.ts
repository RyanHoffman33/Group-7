import { createClient } from "@/lib/supabase/server";
import type {
  CostBudget,
  CostCategory,
  CostEntry,
  CostCommitmentStatus,
  CostApprovalStatus,
} from "@/lib/supabase/types";
import { COST_CATEGORIES } from "@/features/costs/config";
import {
  belongsInFlagsQueue,
  hasAnyFlag,
} from "@/features/costs/flags";

export type CostEntryRow = CostEntry & {
  event_name?: string;
  customer_name?: string;
};

export type BudgetActualRow = {
  category: CostCategory;
  budgeted: number;
  committed: number;
  actual: number;
  variance: number;
};

export type CategoryBreakdownRow = {
  category: CostCategory;
  amount: number;
};

function mapEntry(row: Record<string, unknown>): CostEntry {
  return {
    id: row.id as string,
    contract_id: row.contract_id as string,
    entry_type: row.entry_type as CostEntry["entry_type"],
    category: row.category as CostCategory,
    amount: Number(row.amount),
    hours: row.hours == null ? null : Number(row.hours),
    rate: row.rate == null ? null : Number(row.rate),
    worker_label: (row.worker_label as string | null) ?? null,
    vendor_id: (row.vendor_id as string | null) ?? null,
    vendor_name: (row.vendor_name as string | null) ?? null,
    invoice_ref: (row.invoice_ref as string | null) ?? null,
    commitment_status: row.commitment_status as CostCommitmentStatus,
    approval_status: row.approval_status as CostApprovalStatus,
    is_reimbursable: Boolean(row.is_reimbursable),
    notes: (row.notes as string | null) ?? null,
    entered_by: row.entered_by as string,
    entered_at: row.entered_at as string,
    incurred_date: row.incurred_date as string,
    flag_late_entry: Boolean(row.flag_late_entry),
    flag_duplicate_invoice: Boolean(row.flag_duplicate_invoice),
    flag_over_committed: Boolean(row.flag_over_committed),
    flag_after_billing: Boolean(row.flag_after_billing),
    flag_actual_exceeds_committed: Boolean(row.flag_actual_exceeds_committed),
    flag_no_commitment: Boolean(row.flag_no_commitment),
    prior_committed_amount:
      row.prior_committed_amount == null
        ? null
        : Number(row.prior_committed_amount),
    flags_resolved_at: (row.flags_resolved_at as string | null) ?? null,
    flags_resolved_by: (row.flags_resolved_by as string | null) ?? null,
    flags_resolution_note:
      (row.flags_resolution_note as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function listContractsForCosts(): Promise<
  {
    id: string;
    event_name: string;
    customer_id: string;
    customer_name: string;
    performance_complete: boolean;
  }[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("id, event_name, customer_id, performance_complete, customers(name)")
    .order("event_name");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const customer = row.customers as { name?: string } | { name?: string }[] | null;
    const customerName = Array.isArray(customer)
      ? customer[0]?.name
      : customer?.name;
    return {
      id: row.id as string,
      event_name: row.event_name as string,
      customer_id: row.customer_id as string,
      customer_name: customerName ?? "Unknown customer",
      performance_complete: Boolean(row.performance_complete),
    };
  });
}

export async function getContractForCosts(contractId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id, event_name, customer_id, performance_complete, status, customers(name)",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const customer = data.customers as
    | { name?: string }
    | { name?: string }[]
    | null;
  const customerName = Array.isArray(customer)
    ? customer[0]?.name
    : customer?.name;
  return {
    id: data.id as string,
    event_name: data.event_name as string,
    customer_id: data.customer_id as string,
    customer_name: customerName ?? "Unknown customer",
    performance_complete: Boolean(data.performance_complete),
    status: data.status as string,
  };
}

export async function listCostEntries(filters?: {
  contractId?: string;
  category?: string;
  commitmentStatus?: string;
  approvalStatus?: string;
  flaggedOnly?: boolean;
}): Promise<CostEntryRow[]> {
  const supabase = createClient();
  let q = supabase.from("cost_entries").select("*").order("incurred_date", {
    ascending: false,
  });
  if (filters?.contractId) q = q.eq("contract_id", filters.contractId);
  if (filters?.category) q = q.eq("category", filters.category);
  if (filters?.commitmentStatus)
    q = q.eq("commitment_status", filters.commitmentStatus);
  if (filters?.approvalStatus)
    q = q.eq("approval_status", filters.approvalStatus);

  const { data, error } = await q;
  if (error) throw error;

  const entries = (data ?? []).map((r) => mapEntry(r as Record<string, unknown>));
  const filtered = filters?.flaggedOnly
    ? entries.filter((e) => hasAnyFlag(e))
    : entries;

  const contracts = await listContractsForCosts();
  const byId = new Map(
    contracts.map((c) => [
      c.id,
      { event_name: c.event_name, customer_name: c.customer_name },
    ]),
  );

  return filtered.map((e) => ({
    ...e,
    event_name: byId.get(e.contract_id)?.event_name ?? "Unknown event",
    customer_name: byId.get(e.contract_id)?.customer_name ?? "Unknown customer",
  }));
}

export async function getCostEntry(id: string): Promise<CostEntryRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cost_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const entry = mapEntry(data as Record<string, unknown>);
  const contract = await getContractForCosts(entry.contract_id);
  return {
    ...entry,
    event_name: contract?.event_name ?? "Unknown event",
    customer_name: contract?.customer_name ?? "Unknown customer",
  };
}

export async function listPendingApprovals(): Promise<CostEntryRow[]> {
  return listCostEntries({ approvalStatus: "pending_approval" });
}

export async function listBudgetsForContract(
  contractId: string,
): Promise<CostBudget[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cost_budgets")
    .select("*")
    .eq("contract_id", contractId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    contract_id: r.contract_id as string,
    category: r.category as CostCategory,
    budgeted_amount: Number(r.budgeted_amount),
    created_at: r.created_at as string,
  }));
}

export async function getBudgetVsActual(
  contractId: string,
): Promise<BudgetActualRow[]> {
  const [budgets, entries] = await Promise.all([
    listBudgetsForContract(contractId),
    listCostEntries({ contractId }),
  ]);

  const budgetMap = new Map(
    budgets.map((b) => [b.category, b.budgeted_amount]),
  );

  return COST_CATEGORIES.map((category) => {
    const inCat = entries.filter((e) => e.category === category);
    const committed = inCat
      .filter((e) => e.commitment_status === "committed")
      .reduce((s, e) => s + e.amount, 0);
    const actual = inCat
      .filter((e) => e.commitment_status === "actual")
      .reduce((s, e) => s + e.amount, 0);
    const budgeted = budgetMap.get(category) ?? 0;
    const spent = committed + actual;
    return {
      category,
      budgeted,
      committed,
      actual,
      variance: budgeted - spent,
    };
  }).filter((r) => r.budgeted > 0 || r.committed > 0 || r.actual > 0);
}

export async function getCategoryBreakdown(opts?: {
  contractId?: string;
}): Promise<CategoryBreakdownRow[]> {
  const entries = await listCostEntries(
    opts?.contractId ? { contractId: opts.contractId } : undefined,
  );
  const totals = new Map<CostCategory, number>();
  for (const cat of COST_CATEGORIES) totals.set(cat, 0);
  for (const e of entries) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }
  return COST_CATEGORIES.map((category) => ({
    category,
    amount: totals.get(category) ?? 0,
  })).filter((r) => r.amount > 0);
}

export type AvgCostPerProjectRow = {
  category: CostCategory;
  total: number;
  projectCount: number;
  average: number;
};

/** Average spend per project for each cost category (projects that have that category). */
export async function getAverageCostPerProjectByCategory(): Promise<
  AvgCostPerProjectRow[]
> {
  const entries = await listCostEntries();
  const byCategory = new Map<
    CostCategory,
    { total: number; projects: Set<string> }
  >();

  for (const cat of COST_CATEGORIES) {
    byCategory.set(cat, { total: 0, projects: new Set() });
  }

  for (const e of entries) {
    const bucket = byCategory.get(e.category)!;
    bucket.total += e.amount;
    bucket.projects.add(e.contract_id);
  }

  return COST_CATEGORIES.map((category) => {
    const bucket = byCategory.get(category)!;
    const projectCount = bucket.projects.size;
    return {
      category,
      total: bucket.total,
      projectCount,
      average: projectCount > 0 ? bucket.total / projectCount : 0,
    };
  }).filter((r) => r.projectCount > 0);
}

export async function getCostDashboardStats() {
  const entries = await listCostEntries();
  const totalActual = entries
    .filter((e) => e.commitment_status === "actual")
    .reduce((s, e) => s + e.amount, 0);
  const totalCommitted = entries
    .filter((e) => e.commitment_status === "committed")
    .reduce((s, e) => s + e.amount, 0);
  const pendingApprovals = entries.filter(
    (e) => e.approval_status === "pending_approval",
  ).length;
  // Exclude pending_approval (Approvals owns amount authority) and resolved.
  const openFlags = entries.filter((e) => belongsInFlagsQueue(e)).length;
  return { totalActual, totalCommitted, pendingApprovals, openFlags, entries };
}

export async function contractHasIssuedInvoice(
  contractId: string,
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id")
    .eq("contract_id", contractId)
    .neq("status", "draft")
    .neq("status", "void")
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function listCommittedCosts(): Promise<CostEntryRow[]> {
  return listCostEntries({ commitmentStatus: "committed" });
}

export async function listExceptionCosts(opts?: {
  status?: "open" | "resolved";
}): Promise<CostEntryRow[]> {
  const entries = await listCostEntries();
  const status = opts?.status ?? "open";
  if (status === "resolved") {
    return entries.filter((e) => hasAnyFlag(e) && Boolean(e.flags_resolved_at));
  }
  // Open Flags queue: unresolved control exceptions only.
  // pending_approval amount-queue items are excluded (Approvals owns those).
  return entries.filter((e) => belongsInFlagsQueue(e));
}

export async function listCostHistory(
  costEntryId: string,
): Promise<
  {
    id: string;
    cost_entry_id: string;
    action: string;
    actor: string;
    detail: string | null;
    before_snapshot: Record<string, unknown> | null;
    after_snapshot: Record<string, unknown> | null;
    created_at: string;
  }[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cost_entry_history")
    .select("*")
    .eq("cost_entry_id", costEntryId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    cost_entry_id: r.cost_entry_id as string,
    action: r.action as string,
    actor: r.actor as string,
    detail: (r.detail as string | null) ?? null,
    before_snapshot: (r.before_snapshot as Record<string, unknown> | null) ?? null,
    after_snapshot: (r.after_snapshot as Record<string, unknown> | null) ?? null,
    created_at: r.created_at as string,
  }));
}

export async function listCostsForReport(filters: {
  contractId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<CostEntryRow[]> {
  let rows = await listCostEntries({
    contractId: filters.contractId || undefined,
    category: filters.category || undefined,
  });
  if (filters.dateFrom) {
    rows = rows.filter((e) => e.incurred_date >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    rows = rows.filter((e) => e.incurred_date <= filters.dateTo!);
  }
  return rows;
}
