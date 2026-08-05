import { createClient } from "@/lib/supabase/server";
import {
  buildAgingReport,
  getDashboardMetrics,
  listDeposits,
  type AgingRow,
  type DashboardMetrics,
} from "@/features/billing/queries";
import {
  listContractModifications,
  listProfitabilityInputs,
} from "@/features/gaap/queries";
import { daysPastDue, formatLabel } from "@/features/billing/aging";
import type { BillingMethod, ProfitabilityInput } from "@/lib/supabase/types";

/** Flag budget attention when actual spend reaches this share of budget. */
export const APPROACHING_BUDGET_THRESHOLD = 0.9;

const MS_DAY = 1000 * 60 * 60 * 24;

export type WorkEventStatus = {
  contract_id: string;
  customer_id: string;
  event_name: string;
  contract_status: string;
  performance_complete: boolean;
  customer_name: string;
  promised_count: number;
  scheduled_count: number;
  completed_count: number;
  outstanding_count: number;
  assignment_total: number;
  assignment_completed: number;
  pending_exceptions: number;
  event_start: string | null;
  event_end: string | null;
  outstanding_pct: number;
};

export type ManagerAttentionItem = {
  id: string;
  contractId: string;
  eventName: string;
  customerName?: string;
  reason: string;
  severity: "urgent" | "warning";
  amount?: number;
  date?: string | null;
  href: string;
};

export type UpcomingEventRow = {
  contractId: string;
  eventName: string;
  customerName: string;
  eventStart: string | null;
  eventEnd: string | null;
  billingMethod: BillingMethod | null;
  venue: string | null;
  statusLabel: string;
  progressPercent: number | null;
  deliverableProgress: string | null;
  href: string;
};

export type DeadlineRow = {
  id: string;
  name: string;
  eventName: string;
  dueDate: string;
  status: string;
  overdue: boolean;
  href: string;
};

export type BudgetActualRow = {
  contractId: string;
  eventName: string;
  budgeted: number;
  actual: number;
  variance: number;
  pctUsed: number;
  overBudget: boolean;
  approaching: boolean;
};

export type ProfitabilityRow = {
  contractId: string;
  eventName: string;
  recognizedRevenue: number;
  directEventCogs: number;
  profit: number;
  margin: number | null;
  tone: "ok" | "warn" | "danger" | "neutral";
};

export type PendingApprovalRow = {
  id: string;
  type: string;
  eventName: string;
  requestor: string | null;
  amount: number | null;
  submittedAt: string | null;
  status: string;
  href: string;
};

export type ManagerDashboardData = {
  managerFirstName: string | null;
  todayLabel: string;
  kpis: {
    activeEvents: number;
    upcomingEvents: number;
    outstandingAr: number;
    averageProfitMargin: number | null;
  };
  attention: ManagerAttentionItem[];
  upcomingEvents: UpcomingEventRow[];
  deadlines: DeadlineRow[];
  budgetVsActual: BudgetActualRow[];
  profitability: ProfitabilityRow[];
  pendingApprovals: PendingApprovalRow[];
  ar: DashboardMetrics & {
    overdueAmount: number;
    overdueInvoiceCount: number;
  };
};

function num(v: unknown): number {
  return Number(v ?? 0);
}

function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_DAY);
}

function isActiveEvent(row: {
  contract_status?: string;
  status?: string;
  performance_complete: boolean;
}): boolean {
  const status = row.contract_status ?? row.status ?? "";
  return status === "approved" && !row.performance_complete;
}

async function listWorkEventStatus(): Promise<WorkEventStatus[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_work_event_status")
    .select("*");
  if (error) {
    // View may be unavailable in some environments â€” fall back gracefully.
    console.warn("v_work_event_status unavailable:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    contract_id: String(r.contract_id),
    customer_id: String(r.customer_id),
    event_name: String(r.event_name),
    contract_status: String(r.contract_status),
    performance_complete: Boolean(r.performance_complete),
    customer_name: String(r.customer_name ?? "Unknown"),
    promised_count: num(r.promised_count),
    scheduled_count: num(r.scheduled_count),
    completed_count: num(r.completed_count),
    outstanding_count: num(r.outstanding_count),
    assignment_total: num(r.assignment_total),
    assignment_completed: num(r.assignment_completed),
    pending_exceptions: num(r.pending_exceptions),
    event_start: (r.event_start as string | null) ?? null,
    event_end: (r.event_end as string | null) ?? null,
    outstanding_pct: num(r.outstanding_pct),
  }));
}

async function listBudgetActualRows(): Promise<BudgetActualRow[]> {
  const supabase = createClient();
  const [{ data: budgets, error: bErr }, { data: entries, error: eErr }, { data: contracts, error: cErr }] =
    await Promise.all([
      supabase.from("cost_budgets").select("contract_id, budgeted_amount"),
      supabase
        .from("cost_entries")
        .select("contract_id, amount, commitment_status"),
      supabase.from("contracts").select("id, event_name, performance_complete, status"),
    ]);
  if (bErr) throw bErr;
  if (eErr) throw eErr;
  if (cErr) throw cErr;

  const budgetByContract = new Map<string, number>();
  for (const row of budgets ?? []) {
    const id = String(row.contract_id);
    budgetByContract.set(
      id,
      (budgetByContract.get(id) ?? 0) + num(row.budgeted_amount),
    );
  }

  const actualByContract = new Map<string, number>();
  for (const row of entries ?? []) {
    if (String(row.commitment_status) !== "actual") continue;
    const id = String(row.contract_id);
    actualByContract.set(id, (actualByContract.get(id) ?? 0) + num(row.amount));
  }

  const nameById = new Map(
    (contracts ?? []).map((c) => [String(c.id), String(c.event_name)]),
  );

  const activeIds = new Set(
    (contracts ?? [])
      .filter((c) => isActiveEvent({
        status: String(c.status),
        performance_complete: Boolean(c.performance_complete),
      }))
      .map((c) => String(c.id)),
  );

  const rows: BudgetActualRow[] = [];
  for (const [contractId, budgeted] of budgetByContract) {
    if (!activeIds.has(contractId) && activeIds.size > 0) {
      // Prefer active events; still include if no active set matched.
    }
    const actual = actualByContract.get(contractId) ?? 0;
    const variance = budgeted - actual;
    const pctUsed = budgeted > 0 ? actual / budgeted : 0;
    rows.push({
      contractId,
      eventName: nameById.get(contractId) ?? "Unknown event",
      budgeted,
      actual,
      variance,
      pctUsed,
      overBudget: actual > budgeted && budgeted > 0,
      approaching:
        budgeted > 0 &&
        pctUsed >= APPROACHING_BUDGET_THRESHOLD &&
        actual <= budgeted,
    });
  }

  // Prefer active events with budgets; fall back to any budgeted events.
  const activeRows = rows.filter((r) => activeIds.has(r.contractId));
  const pool = activeRows.length > 0 ? activeRows : rows;
  return pool
    .sort((a, b) => b.pctUsed - a.pctUsed || a.eventName.localeCompare(b.eventName))
    .slice(0, 5);
}

export async function getManagerDashboardData(): Promise<ManagerDashboardData> {
  const supabase = createClient();
  const today = startOfToday();
  const in30 = addDays(today, 30);

  const [
    contractsRes,
    workEvents,
    aging,
    metrics,
    profitabilityInputs,
    mods,
    deposits,
    budgets,
    costEntries,
    assignments,
    exceptions,
    milestones,
    deliverables,
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, customer_id, event_name, status, performance_complete, progress_percent, billing_method, deposit_required, customers(name)",
      ),
    listWorkEventStatus(),
    buildAgingReport(),
    getDashboardMetrics(),
    listProfitabilityInputs(),
    listContractModifications(),
    listDeposits(),
    supabase.from("cost_budgets").select("contract_id, category, budgeted_amount"),
    supabase
      .from("cost_entries")
      .select(
        "id, contract_id, category, amount, commitment_status, approval_status, entered_by, entered_at, flag_over_committed, vendor_name",
      ),
    supabase
      .from("work_assignments")
      .select("id, contract_id, title, status, scheduled_end, created_at"),
    supabase
      .from("work_exceptions")
      .select(
        "id, contract_id, exception_type, description, status, estimated_amount, created_at, submitted_by_party_id",
      ),
    supabase
      .from("contract_milestones")
      .select("id, contract_id, label, due_date, completed"),
    supabase
      .from("contract_deliverables")
      .select("id, contract_id, title, location, scheduled_start, scheduled_end, status"),
  ]);

  if (contractsRes.error) throw contractsRes.error;
  // Soft-fail teammate tables that may lack grants in some environments
  const costBudgets = budgets.error ? [] : (budgets.data ?? []);
  const costs = costEntries.error ? [] : (costEntries.data ?? []);
  const workAssignments = assignments.error ? [] : (assignments.data ?? []);
  const workExceptions = exceptions.error ? [] : (exceptions.data ?? []);
  const milestoneRows = milestones.error ? [] : (milestones.data ?? []);
  const deliverableRows = deliverables.error ? [] : (deliverables.data ?? []);

  type ContractRow = {
    id: string;
    customer_id: string;
    event_name: string;
    status: string;
    performance_complete: boolean;
    progress_percent: number | null;
    billing_method: BillingMethod | null;
    deposit_required: boolean;
    customers?: { name: string } | null;
  };

  const contracts = (contractsRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      customer_id: string;
      event_name: string;
      status: string;
      performance_complete: boolean;
      progress_percent: number | null;
      billing_method: BillingMethod | null;
      deposit_required: boolean;
      customers?: { name: string } | { name: string }[] | null;
    };
    const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers;
    return {
      id: r.id,
      customer_id: r.customer_id,
      event_name: r.event_name,
      status: r.status,
      performance_complete: r.performance_complete,
      progress_percent: r.progress_percent,
      billing_method: r.billing_method,
      deposit_required: r.deposit_required,
      customers: customer ? { name: customer.name } : null,
    } satisfies ContractRow;
  });
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const workByContract = new Map(workEvents.map((w) => [w.contract_id, w]));

  const venueByContract = new Map<string, string>();
  for (const d of deliverableRows) {
    const loc = d.location as string | null;
    if (!loc) continue;
    const id = String(d.contract_id);
    if (!venueByContract.has(id)) venueByContract.set(id, loc);
  }

  const activeContracts = contracts.filter((c) =>
    isActiveEvent({
      status: c.status,
      performance_complete: c.performance_complete,
    }),
  );

  const upcomingCount = workEvents.filter((w) => {
    if (!isActiveEvent(w)) return false;
    if (!w.event_start) return false;
    const start = new Date(w.event_start);
    return start >= today && start <= in30;
  }).length;

  // Fallback upcoming count from deliverables if work view empty
  let upcomingEventsKpi = upcomingCount;
  if (workEvents.length === 0) {
    const starts = new Map<string, Date>();
    for (const d of deliverableRows) {
      if (!d.scheduled_start) continue;
      const id = String(d.contract_id);
      const t = new Date(String(d.scheduled_start));
      const prev = starts.get(id);
      if (!prev || t < prev) starts.set(id, t);
    }
    upcomingEventsKpi = activeContracts.filter((c) => {
      const s = starts.get(c.id);
      return s != null && s >= today && s <= in30;
    }).length;
  }

  const profitRows = buildProfitabilityRows(profitabilityInputs);
  const marginValues = profitRows
    .filter((p) => p.recognizedRevenue > 0 && p.margin != null)
    .map((p) => p.margin as number);
  const averageProfitMargin =
    marginValues.length > 0
      ? marginValues.reduce((s, m) => s + m, 0) / marginValues.length
      : portfolioMargin(profitabilityInputs);

  const actualByContract = new Map<string, number>();
  for (const e of costs) {
    if (String(e.commitment_status) !== "actual") continue;
    const cid = String(e.contract_id);
    actualByContract.set(cid, (actualByContract.get(cid) ?? 0) + num(e.amount));
  }
  const totalBudgetByContract = new Map<string, number>();
  for (const b of costBudgets) {
    const cid = String(b.contract_id);
    totalBudgetByContract.set(
      cid,
      (totalBudgetByContract.get(cid) ?? 0) + num(b.budgeted_amount),
    );
  }

  const attention: ManagerAttentionItem[] = [];

  for (const [contractId, budgeted] of totalBudgetByContract) {
    const c = contractById.get(contractId);
    if (!c || !isActiveEvent(c)) continue;
    const actual = actualByContract.get(contractId) ?? 0;
    if (budgeted <= 0) continue;
    const pct = actual / budgeted;
    if (actual > budgeted) {
      attention.push({
        id: `over-budget-${contractId}`,
        contractId,
        eventName: c.event_name,
        customerName: c.customers?.name,
        reason: "Over budget",
        severity: "urgent",
        amount: actual - budgeted,
        href: "/compliance/costs",
      });
    } else if (pct >= APPROACHING_BUDGET_THRESHOLD) {
      attention.push({
        id: `approach-budget-${contractId}`,
        contractId,
        eventName: c.event_name,
        customerName: c.customers?.name,
        reason: `Approaching budget limit (${Math.round(pct * 100)}%)`,
        severity: "warning",
        amount: budgeted - actual,
        href: "/compliance/costs",
      });
    }
  }

  for (const e of costs) {
    if (!e.flag_over_committed) continue;
    const c = contractById.get(String(e.contract_id));
    if (!c || !isActiveEvent(c)) continue;
    attention.push({
      id: `over-commit-${e.id}`,
      contractId: c.id,
      eventName: c.event_name,
      customerName: c.customers?.name,
      reason: `Unexpected / over-committed ${formatLabel(String(e.category))} cost`,
      severity: "urgent",
      amount: num(e.amount),
      href: "/compliance/costs",
    });
  }

  for (const a of workAssignments) {
    const status = String(a.status);
    if (status === "completed") continue;
    if (!a.scheduled_end) continue;
    const end = new Date(String(a.scheduled_end));
    if (end >= today) continue;
    const c = contractById.get(String(a.contract_id));
    if (!c) continue;
    attention.push({
      id: `overdue-task-${a.id}`,
      contractId: c.id,
      eventName: c.event_name,
      customerName: c.customers?.name,
      reason: `Overdue task: ${a.title}`,
      severity: "urgent",
      date: String(a.scheduled_end),
      href: "/compliance",
    });
  }

  for (const m of mods) {
    if (m.status !== "draft" && m.status !== "approved") continue;
    attention.push({
      id: `mod-${m.id}`,
      contractId: m.contract_id,
      eventName: m.event_name ?? "Unknown event",
      customerName: m.customer_name,
      reason:
        m.status === "draft"
          ? "Unapproved change order"
          : "Change order approved — not yet applied",
      severity: "warning",
      amount: m.price_change,
      date: m.created_at,
      href: "/compliance/modifications",
    });
  }

  for (const row of aging) {
    if (row.days_past_due <= 0) continue;
    attention.push({
      id: `inv-${row.invoice_id}`,
      contractId: row.contract_id,
      eventName: row.event_name,
      customerName: row.customer_name,
      reason: `Overdue invoice ${row.invoice_number}`,
      severity: row.days_past_due > 30 ? "urgent" : "warning",
      amount: row.outstanding,
      date: row.due_date,
      href: `/billing/invoices/${row.invoice_id}`,
    });
  }

  const depositsByContract = new Map<string, number>();
  for (const d of deposits) {
    depositsByContract.set(
      d.contract_id,
      (depositsByContract.get(d.contract_id) ?? 0) + 1,
    );
  }
  for (const c of activeContracts) {
    if (!c.deposit_required) continue;
    if ((depositsByContract.get(c.id) ?? 0) > 0) continue;
    const work = workByContract.get(c.id);
    const start = work?.event_start ? new Date(work.event_start) : null;
    if (start && start <= addDays(today, 14)) {
      attention.push({
        id: `deposit-${c.id}`,
        contractId: c.id,
        eventName: c.event_name,
        customerName: c.customers?.name,
        reason: "Overdue deposit — none recorded",
        severity: "urgent",
        date: work?.event_start,
        href: "/billing/deposits",
      });
    }
  }

  for (const w of workEvents) {
    if (!isActiveEvent(w) || !w.event_start) continue;
    const start = new Date(w.event_start);
    if (start < today || start > addDays(today, 14)) continue;
    const incomplete =
      w.outstanding_count > 0 ||
      w.assignment_total - w.assignment_completed > 0;
    if (!incomplete) continue;
    attention.push({
      id: `approach-event-${w.contract_id}`,
      contractId: w.contract_id,
      eventName: w.event_name,
      customerName: w.customer_name,
      reason: "Event approaching with incomplete work",
      severity: "warning",
      date: w.event_start,
      href: "/compliance",
    });
  }

  for (const e of workExceptions) {
    const st = String(e.status);
    if (st !== "submitted" && st !== "pending_approval") continue;
    const c = contractById.get(String(e.contract_id));
    if (!c) continue;
    attention.push({
      id: `exc-${e.id}`,
      contractId: c.id,
      eventName: c.event_name,
      customerName: c.customers?.name,
      reason: `Pending exception: ${formatLabel(String(e.exception_type))}`,
      severity: "warning",
      amount: e.estimated_amount != null ? num(e.estimated_amount) : undefined,
      date: e.created_at ? String(e.created_at) : null,
      href: "/compliance",
    });
  }

  const seen = new Set<string>();
  const attentionSorted = attention
    .filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "urgent" ? -1 : 1;
      return (a.eventName ?? "").localeCompare(b.eventName ?? "");
    });

  const upcomingEvents = buildUpcomingEvents(
    contracts,
    workEvents,
    venueByContract,
    today,
  );

  const deadlines = buildDeadlines({
    contracts,
    milestones: milestoneRows,
    assignments: workAssignments,
    aging,
    mods,
    today,
  });

  const budgetVsActual = await listBudgetActualRows();

  const pendingApprovals = buildPendingApprovals({
    mods,
    costs,
    exceptions: workExceptions,
    contractById,
  });

  const overdueAging = aging.filter((r) => r.days_past_due > 0);
  // Auth / Users & Roles not wired yet â€” avoid hard-coding a demo manager name.
  const managerFirstName: string | null = null;

  const todayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    managerFirstName,
    todayLabel,
    kpis: {
      activeEvents: activeContracts.length,
      upcomingEvents: upcomingEventsKpi,
      outstandingAr: metrics.totalOutstanding,
      averageProfitMargin,
    },
    attention: attentionSorted,
    upcomingEvents,
    deadlines,
    budgetVsActual,
    profitability: profitRows.slice(0, 8),
    pendingApprovals,
    ar: {
      ...metrics,
      overdueAmount: overdueAging.reduce((s, r) => s + r.outstanding, 0),
      overdueInvoiceCount: overdueAging.length,
    },
  };
}

function portfolioMargin(rows: ProfitabilityInput[]): number | null {
  const rev = rows.reduce((s, r) => s + Number(r.recognized_revenue), 0);
  const cogs = rows.reduce((s, r) => s + Number(r.direct_event_cogs), 0);
  if (rev <= 0) return null;
  return (rev - cogs) / rev;
}

function buildProfitabilityRows(rows: ProfitabilityInput[]): ProfitabilityRow[] {
  return rows
    .map((p) => {
      const recognizedRevenue = Number(p.recognized_revenue);
      const directEventCogs = Number(p.direct_event_cogs);
      const profit = recognizedRevenue - directEventCogs;
      const margin =
        recognizedRevenue > 0 ? profit / recognizedRevenue : null;
      let tone: ProfitabilityRow["tone"] = "neutral";
      if (recognizedRevenue > 0) {
        if (profit < 0) tone = "danger";
        else if (margin != null && margin < 0.1) tone = "warn";
        else tone = "ok";
      }
      return {
        contractId: p.contract_id,
        eventName: p.event_name,
        recognizedRevenue,
        directEventCogs,
        profit,
        margin,
        tone,
      };
    })
    .sort((a, b) => {
      const am = a.margin ?? -999;
      const bm = b.margin ?? -999;
      return am - bm;
    });
}

function buildUpcomingEvents(
  contracts: {
    id: string;
    event_name: string;
    customers?: { name: string } | null;
    billing_method: BillingMethod | null;
    performance_complete: boolean;
    status: string;
    progress_percent: number | null;
  }[],
  workEvents: WorkEventStatus[],
  venueByContract: Map<string, string>,
  today: Date,
): UpcomingEventRow[] {
  const workById = new Map(workEvents.map((w) => [w.contract_id, w]));

  const rows: UpcomingEventRow[] = contracts
    .filter((c) => isActiveEvent(c))
    .map((c) => {
      const w = workById.get(c.id);
      const deliverableProgress =
        w && w.promised_count + w.scheduled_count + w.completed_count > 0
          ? `${w.completed_count} of ${w.completed_count + w.outstanding_count} deliverables complete`
          : null;
      return {
        contractId: c.id,
        eventName: c.event_name,
        customerName: c.customers?.name ?? w?.customer_name ?? "â€”",
        eventStart: w?.event_start ?? null,
        eventEnd: w?.event_end ?? null,
        billingMethod: c.billing_method,
        venue: venueByContract.get(c.id) ?? null,
        statusLabel: c.performance_complete ? "Complete" : "In progress",
        progressPercent:
          c.progress_percent != null ? Number(c.progress_percent) : null,
        deliverableProgress,
        href: "/compliance",
      };
    })
    .filter((r) => r.eventStart != null)
    .sort((a, b) => {
      const at = new Date(a.eventStart!).getTime();
      const bt = new Date(b.eventStart!).getTime();
      return at - bt;
    })
    .filter((r) => new Date(r.eventStart!) >= today)
    .slice(0, 6);

  return rows;
}

function buildDeadlines(args: {
  contracts: { id: string; event_name: string }[];
  milestones: { id: unknown; contract_id: unknown; label: unknown; due_date: unknown; completed: unknown }[];
  assignments: { id: unknown; contract_id: unknown; title: unknown; status: unknown; scheduled_end: unknown }[];
  aging: AgingRow[];
  mods: { id: string; contract_id: string; mod_number: string; status: string; effective_date: string; event_name?: string }[];
  today: Date;
}): DeadlineRow[] {
  const nameById = new Map(args.contracts.map((c) => [c.id, c.event_name]));
  const rows: DeadlineRow[] = [];

  for (const m of args.milestones) {
    if (m.completed) continue;
    if (!m.due_date) continue;
    const due = String(m.due_date);
    const dpd = daysPastDue(due, args.today);
    rows.push({
      id: `ms-${m.id}`,
      name: String(m.label),
      eventName: nameById.get(String(m.contract_id)) ?? "â€”",
      dueDate: due,
      status: dpd > 0 ? "Overdue" : "Upcoming",
      overdue: dpd > 0,
      href: "/billing/determine",
    });
  }

  for (const a of args.assignments) {
    if (String(a.status) === "completed") continue;
    if (!a.scheduled_end) continue;
    const due = String(a.scheduled_end).slice(0, 10);
    const dpd = daysPastDue(due, args.today);
    rows.push({
      id: `as-${a.id}`,
      name: String(a.title),
      eventName: nameById.get(String(a.contract_id)) ?? "â€”",
      dueDate: due,
      status: dpd > 0 ? "Overdue" : formatLabel(String(a.status)),
      overdue: dpd > 0,
      href: "/compliance",
    });
  }

  for (const inv of args.aging) {
    rows.push({
      id: `pay-${inv.invoice_id}`,
      name: `Invoice ${inv.invoice_number} payment`,
      eventName: inv.event_name,
      dueDate: inv.due_date,
      status: inv.days_past_due > 0 ? "Overdue" : "Due",
      overdue: inv.days_past_due > 0,
      href: `/billing/invoices/${inv.invoice_id}`,
    });
  }

  for (const m of args.mods) {
    if (m.status === "applied") continue;
    rows.push({
      id: `mod-dl-${m.id}`,
      name: `Change order ${m.mod_number} approval`,
      eventName: m.event_name ?? nameById.get(m.contract_id) ?? "â€”",
      dueDate: m.effective_date,
      status: formatLabel(m.status),
      overdue: daysPastDue(m.effective_date, args.today) > 0 && m.status === "draft",
      href: "/compliance/modifications",
    });
  }

  return rows
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 10);
}

function buildPendingApprovals(args: {
  mods: {
    id: string;
    mod_number: string;
    status: string;
    price_change: number;
    created_at: string;
    event_name?: string;
    customer_name?: string;
    approved_by?: string | null;
  }[];
  costs: {
    id: unknown;
    contract_id: unknown;
    amount: unknown;
    approval_status: unknown;
    entered_by: unknown;
    entered_at: unknown;
    category: unknown;
    vendor_name: unknown;
  }[];
  exceptions: {
    id: unknown;
    contract_id: unknown;
    exception_type: unknown;
    status: unknown;
    estimated_amount: unknown;
    created_at: unknown;
  }[];
  contractById: Map<
    string,
    { event_name: string; customers?: { name: string } | null }
  >;
}): PendingApprovalRow[] {
  const rows: PendingApprovalRow[] = [];

  for (const m of args.mods) {
    if (m.status !== "draft" && m.status !== "approved") continue;
    rows.push({
      id: `pa-mod-${m.id}`,
      type: "Change order",
      eventName: m.event_name ?? "â€”",
      requestor: m.approved_by ?? null,
      amount: m.price_change,
      submittedAt: m.created_at,
      status: formatLabel(m.status),
      href: "/compliance/modifications",
    });
  }

  for (const e of args.costs) {
    if (String(e.approval_status) !== "pending_approval") continue;
    const c = args.contractById.get(String(e.contract_id));
    rows.push({
      id: `pa-cost-${e.id}`,
      type: `Expense (${formatLabel(String(e.category))})`,
      eventName: c?.event_name ?? "â€”",
      requestor: e.entered_by
        ? String(e.entered_by)
        : e.vendor_name
          ? String(e.vendor_name)
          : null,
      amount: num(e.amount),
      submittedAt: e.entered_at ? String(e.entered_at) : null,
      status: "Pending approval",
      href: "/compliance/costs",
    });
  }

  for (const e of args.exceptions) {
    const st = String(e.status);
    if (st !== "submitted" && st !== "pending_approval") continue;
    const c = args.contractById.get(String(e.contract_id));
    rows.push({
      id: `pa-exc-${e.id}`,
      type: `Work exception (${formatLabel(String(e.exception_type))})`,
      eventName: c?.event_name ?? "â€”",
      requestor: null,
      amount: e.estimated_amount != null ? num(e.estimated_amount) : null,
      submittedAt: e.created_at ? String(e.created_at) : null,
      status: formatLabel(st),
      href: "/compliance",
    });
  }

  return rows.sort((a, b) =>
    String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")),
  );
}
