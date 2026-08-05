import { createClient } from "@/lib/supabase/server";
import {
  daysPastDue,
  formatLabel,
} from "@/features/billing/aging";
import {
  buildAgingReport,
  getDashboardMetrics,
  listBillingSchedules,
  listPayments,
  type AgingRow,
} from "@/features/billing/queries";
import {
  getPositionTotals,
  listContractModifications,
  listContractPositions,
} from "@/features/gaap/queries";

const DUE_SOON_DAYS = 7;
const UPCOMING_BILLING_DAYS = 30;
const ATTENTION_LIMIT = 12;
const PAYMENT_LIMIT = 8;
const MILESTONE_LIMIT = 8;
const EXCEPTION_LIMIT = 8;

export type AccountingKpis = {
  totalAr: number;
  overdueAr: number;
  overdueCount: number;
  paymentsReceived: number;
  paymentsPeriodLabel: string;
  upcomingBilling: number;
  upcomingBillingPeriodLabel: string;
  upcomingBillingSupported: boolean;
};

export type AccountingAttentionIssue =
  | "Overdue"
  | "Due soon"
  | "Partially paid"
  | "Disputed"
  | "Unallocated payment risk";

export type AccountingAttentionRow = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  eventName: string;
  invoiceAmount: number;
  amountPaid: number;
  outstanding: number;
  issue: AccountingAttentionIssue;
  dueDate: string;
  daysPastDue: number;
  href: string;
  priority: number;
};

export type AccountingAgingBucket = {
  key: "0-30" | "31-60" | "61-90" | "90+";
  label: string;
  amount: number;
};

export type AccountingMilestoneRow = {
  id: string;
  kind: "milestone" | "schedule";
  label: string;
  customerName: string;
  eventName: string;
  amount: number;
  dueDate: string | null;
  href: string;
};

export type AccountingPaymentRow = {
  id: string;
  customerName: string;
  eventOrInvoice: string;
  paidAt: string;
  amount: number;
  allocationStatus: "Fully allocated" | "Partially allocated" | "Unallocated";
  allocatedAmount: number;
  href: string;
};

export type AccountingRevenueStatus = {
  recognizedRevenueBilled: number;
  billedNotYetRecognized: number;
  earnedNotYetBilled: number;
  customerDepositsUnearned: number;
};

export type AccountingExceptionRow = {
  id: string;
  title: string;
  detail: string;
  amount: number | null;
  status: string;
  href: string;
  severity: "urgent" | "warning";
};

export type AccountingExceptionGroup = {
  id: string;
  label: string;
  count: number;
  href: string;
};

export type AccountingDashboardData = {
  accountantFirstName: string | null;
  todayLabel: string;
  agingBasisNote: string;
  kpis: AccountingKpis;
  attention: AccountingAttentionRow[];
  aging: AccountingAgingBucket[];
  milestones: AccountingMilestoneRow[];
  payments: AccountingPaymentRow[];
  revenue: AccountingRevenueStatus;
  exceptions: AccountingExceptionRow[];
  exceptionGroups: AccountingExceptionGroup[];
};

function relOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthPeriodLabel(d: Date): string {
  const name = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return `Month to date (${name})`;
}

function priorityForIssue(issue: AccountingAttentionIssue, dpd: number, outstanding: number): number {
  if (issue === "Disputed") return 0;
  if (issue === "Overdue") return 1 + Math.min(dpd, 365) / 1000;
  if (issue === "Partially paid") return 2;
  if (issue === "Due soon") return 3;
  return 4 + outstanding / 1e9;
}

export async function getAccountingDashboardData(): Promise<AccountingDashboardData> {
  const today = new Date();
  const todayStr = isoDate(today);
  const monthFrom = isoDate(monthStart(today));
  const upcomingThrough = isoDate(addDays(today, UPCOMING_BILLING_DAYS));

  const [
    metrics,
    aging,
    payments,
    schedules,
    positions,
    mods,
    milestoneBundle,
    disputedBundle,
    applicationRows,
    overBudgetCount,
  ] = await Promise.all([
    getDashboardMetrics(),
    buildAgingReport(),
    listPayments(),
    listBillingSchedules(),
    listContractPositions(),
    listContractModifications(),
    listUpcomingMilestones(todayStr, upcomingThrough),
    listDisputedOpenInvoices(),
    listPaymentApplicationTotals(),
    countOverBudgetEvents(),
  ]);

  const totals = await getPositionTotals(positions);

  // --- KPIs ---
  const overdueRows = aging.filter((r) => daysPastDue(r.due_date, today) > 0);
  const overdueAr = overdueRows.reduce((s, r) => s + r.outstanding, 0);

  const mtdPayments = payments.filter((p) => {
    const day = p.paid_at.slice(0, 10);
    return day >= monthFrom && day <= todayStr;
  });
  const paymentsReceived = mtdPayments.reduce((s, p) => s + Number(p.amount), 0);

  const activeSchedulesUpcoming = schedules.filter(
    (s) =>
      s.active &&
      s.next_run_date >= todayStr &&
      s.next_run_date <= upcomingThrough,
  );
  const scheduleUpcomingAmt = activeSchedulesUpcoming.reduce(
    (s, r) => s + Number(r.amount),
    0,
  );
  const milestoneUpcomingAmt = milestoneBundle.reduce(
    (s, r) => s + r.amount,
    0,
  );
  const upcomingBilling = scheduleUpcomingAmt + milestoneUpcomingAmt;
  const upcomingBillingSupported =
    milestoneBundle.length > 0 || activeSchedulesUpcoming.length > 0;

  const kpis: AccountingKpis = {
    totalAr: metrics.totalOutstanding,
    overdueAr,
    overdueCount: overdueRows.length,
    paymentsReceived,
    paymentsPeriodLabel: monthPeriodLabel(today),
    upcomingBilling,
    upcomingBillingPeriodLabel: `Next ${UPCOMING_BILLING_DAYS} days`,
    upcomingBillingSupported,
  };

  // --- Attention invoices ---
  const attentionMap = new Map<string, AccountingAttentionRow>();

  function upsertAttention(row: AccountingAttentionRow) {
    const existing = attentionMap.get(row.invoiceId);
    if (!existing || row.priority < existing.priority) {
      attentionMap.set(row.invoiceId, row);
    }
  }

  for (const r of aging) {
    const dpd = daysPastDue(r.due_date, today);
    const base = {
      id: r.invoice_id,
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name,
      eventName: r.event_name,
      invoiceAmount: r.total,
      amountPaid: r.amount_paid,
      outstanding: r.outstanding,
      dueDate: r.due_date,
      daysPastDue: Math.max(0, dpd),
      href: `/billing/invoices/${r.invoice_id}`,
    };

    if (dpd > 0) {
      upsertAttention({
        ...base,
        issue: "Overdue",
        priority: priorityForIssue("Overdue", dpd, r.outstanding),
      });
    } else if (dpd >= -DUE_SOON_DAYS) {
      upsertAttention({
        ...base,
        issue: "Due soon",
        priority: priorityForIssue("Due soon", dpd, r.outstanding),
      });
    }

    if (r.status === "partially_paid" || (r.amount_paid > 0 && r.outstanding > 0)) {
      upsertAttention({
        ...base,
        issue: "Partially paid",
        priority: priorityForIssue("Partially paid", dpd, r.outstanding),
      });
    }
  }

  for (const d of disputedBundle) {
    upsertAttention({
      id: d.invoiceId,
      invoiceId: d.invoiceId,
      invoiceNumber: d.invoiceNumber,
      customerName: d.customerName,
      eventName: d.eventName,
      invoiceAmount: d.total,
      amountPaid: d.amountPaid,
      outstanding: d.outstanding,
      issue: "Disputed",
      dueDate: d.dueDate,
      daysPastDue: Math.max(0, daysPastDue(d.dueDate, today)),
      href: `/billing/invoices/${d.invoiceId}`,
      priority: priorityForIssue("Disputed", 0, d.outstanding),
    });
  }

  const attention = [...attentionMap.values()]
    .sort((a, b) => a.priority - b.priority || b.outstanding - a.outstanding)
    .slice(0, ATTENTION_LIMIT);

  // --- Aging summary (due-date basis) ---
  const agingBuckets = summarizeAging(aging);

  // --- Upcoming milestones / schedules ---
  const milestoneRows: AccountingMilestoneRow[] = [
    ...milestoneBundle.map((m) => ({
      id: m.id,
      kind: "milestone" as const,
      label: m.label,
      customerName: m.customerName,
      eventName: m.eventName,
      amount: m.amount,
      dueDate: m.dueDate,
      href: "/billing/determine",
    })),
    ...activeSchedulesUpcoming.map((s) => ({
      id: s.id,
      kind: "schedule" as const,
      label: s.label || formatLabel(s.billing_method),
      customerName: s.customer_name ?? "—",
      eventName: s.event_name ?? "—",
      amount: Number(s.amount),
      dueDate: s.next_run_date,
      href: "/billing/recurring",
    })),
  ]
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, MILESTONE_LIMIT);

  // --- Recent payments ---
  const appsByPayment = applicationRows;
  const recentPayments: AccountingPaymentRow[] = payments
    .slice(0, PAYMENT_LIMIT)
    .map((p) => {
      const allocated = appsByPayment.get(p.id) ?? {
        total: 0,
        invoiceLabels: [] as string[],
      };
      let allocationStatus: AccountingPaymentRow["allocationStatus"] =
        "Unallocated";
      if (allocated.total <= 0) allocationStatus = "Unallocated";
      else if (allocated.total + 0.005 >= Number(p.amount))
        allocationStatus = "Fully allocated";
      else allocationStatus = "Partially allocated";

      return {
        id: p.id,
        customerName: p.customer_name ?? "—",
        eventOrInvoice:
          allocated.invoiceLabels.length > 0
            ? allocated.invoiceLabels.join(", ")
            : "No invoice allocation",
        paidAt: p.paid_at,
        amount: Number(p.amount),
        allocationStatus,
        allocatedAmount: allocated.total,
        href: "/billing/payments",
      };
    });

  // --- Revenue / ASC 606 status (team-supported categories only) ---
  const revenue: AccountingRevenueStatus = {
    recognizedRevenueBilled: totals.recognizedBilled,
    billedNotYetRecognized: totals.deferredBilled,
    earnedNotYetBilled: totals.earnedNotBilled,
    customerDepositsUnearned: totals.unearnedDeposits,
  };

  // --- Exceptions ---
  const exceptions: AccountingExceptionRow[] = [];

  for (const m of mods) {
    if (m.status !== "draft" && m.status !== "approved") continue;
    exceptions.push({
      id: `mod-${m.id}`,
      title:
        m.status === "draft"
          ? "Unapproved change order"
          : "Approved change order not applied",
      detail: `${m.event_name ?? "Event"} · ${m.mod_number ?? m.id.slice(0, 8)}`,
      amount: m.price_change,
      status: m.status,
      href: "/compliance/modifications",
      severity: m.status === "draft" ? "warning" : "urgent",
    });
  }

  for (const p of recentPayments) {
    if (p.allocationStatus === "Unallocated" || p.allocationStatus === "Partially allocated") {
      exceptions.push({
        id: `pay-alloc-${p.id}`,
        title:
          p.allocationStatus === "Unallocated"
            ? "Payment not allocated"
            : "Payment partially allocated",
        detail: `${p.customerName} · ${p.eventOrInvoice}`,
        amount: p.amount - p.allocatedAmount,
        status: p.allocationStatus,
        href: p.href,
        severity: "warning",
      });
    }
  }

  // Over-budget events that affect billing review (from GAAP position: earned > billed heavily is ok; use positions where contract liability vs asset imbalance isn't the signal — reuse cost overruns if available lightly)
  for (const pos of positions) {
    if (pos.contract_asset > 0 && pos.open_ar === 0 && pos.earned_to_date > pos.billed_to_date) {
      // Earned not billed is already in revenue status; skip duplicate noise
      continue;
    }
  }

  exceptions.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "urgent" ? -1 : 1;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });

  const draftMods = mods.filter((m) => m.status === "draft").length;
  const approvedMods = mods.filter((m) => m.status === "approved").length;
  const unallocatedPays = recentPayments.filter(
    (p) =>
      p.allocationStatus === "Unallocated" ||
      p.allocationStatus === "Partially allocated",
  ).length;

  const exceptionGroups: AccountingExceptionGroup[] = [
    {
      id: "unapproved-cos",
      label: "Unapproved Change Orders",
      count: draftMods,
      href: "/compliance/modifications",
    },
    {
      id: "over-budget",
      label: "Events Over Budget",
      count: overBudgetCount,
      href: "/compliance/costs",
    },
    {
      id: "payment-alloc",
      label: "Payments Not Fully Allocated",
      count: unallocatedPays,
      href: "/billing/payments",
    },
    {
      id: "disputed",
      label: "Disputed Invoices",
      count: disputedBundle.length,
      href: "/billing/invoices",
    },
    {
      id: "mods-apply",
      label: "Change Orders Awaiting Apply",
      count: approvedMods,
      href: "/compliance/modifications",
    },
  ].filter((g) => g.count > 0);

  const todayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    // Auth / Users & Roles not wired yet — avoid hard-coding a name.
    accountantFirstName: null,
    todayLabel,
    agingBasisNote:
      "Aging is based on invoice due date for open outstanding balances only (issued / partially paid, net of payment applications). Fully paid, canceled, and voided invoices are excluded.",
    kpis,
    attention,
    aging: agingBuckets,
    milestones: milestoneRows,
    payments: recentPayments,
    revenue,
    exceptions: exceptions.slice(0, EXCEPTION_LIMIT),
    exceptionGroups,
  };
}

function summarizeAging(aging: AgingRow[]): AccountingAgingBucket[] {
  const amounts = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  } as Record<AccountingAgingBucket["key"], number>;

  for (const row of aging) {
    if (row.bucket === "current" || row.bucket === "1-30") {
      amounts["0-30"] += row.outstanding;
    } else if (row.bucket === "31-60") {
      amounts["31-60"] += row.outstanding;
    } else if (row.bucket === "61-90") {
      amounts["61-90"] += row.outstanding;
    } else {
      amounts["90+"] += row.outstanding;
    }
  }

  return [
    { key: "0-30", label: "0–30 days", amount: amounts["0-30"] },
    { key: "31-60", label: "31–60 days", amount: amounts["31-60"] },
    { key: "61-90", label: "61–90 days", amount: amounts["61-90"] },
    { key: "90+", label: "90+ days", amount: amounts["90+"] },
  ];
}

async function countOverBudgetEvents(): Promise<number> {
  const supabase = createClient();
  const [{ data: budgets, error: bErr }, { data: entries, error: eErr }] =
    await Promise.all([
      supabase.from("cost_budgets").select("contract_id, budgeted_amount"),
      supabase
        .from("cost_entries")
        .select("contract_id, amount, commitment_status"),
    ]);
  if (bErr) throw bErr;
  if (eErr) throw eErr;

  const budgetBy = new Map<string, number>();
  for (const row of budgets ?? []) {
    const id = String(row.contract_id);
    budgetBy.set(id, (budgetBy.get(id) ?? 0) + Number(row.budgeted_amount ?? 0));
  }
  const actualBy = new Map<string, number>();
  for (const row of entries ?? []) {
    if (String(row.commitment_status) !== "actual") continue;
    const id = String(row.contract_id);
    actualBy.set(id, (actualBy.get(id) ?? 0) + Number(row.amount ?? 0));
  }

  let n = 0;
  for (const [id, budgeted] of budgetBy) {
    const actual = actualBy.get(id) ?? 0;
    if (budgeted > 0 && actual > budgeted) n += 1;
  }
  return n;
}

async function listUpcomingMilestones(from: string, through: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_milestones")
    .select("id, contract_id, milestone_key, label, amount, due_date, completed, billed_invoice_id")
    .is("billed_invoice_id", null)
    .not("due_date", "is", null)
    .gte("due_date", from)
    .lte("due_date", through)
    .order("due_date");

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const contractIds = [...new Set(rows.map((r) => r.contract_id as string))];
  const { data: contracts, error: cErr } = await supabase
    .from("contracts")
    .select("id, event_name, customer_id, customers(name)")
    .in("id", contractIds);
  if (cErr) throw cErr;

  const meta = new Map(
    (contracts ?? []).map((c) => {
      const row = c as {
        id: string;
        event_name: string;
        customers?: { name: string } | { name: string }[] | null;
      };
      const customer = relOne(row.customers);
      return [
        row.id,
        {
          eventName: row.event_name,
          customerName: customer?.name ?? "—",
        },
      ] as const;
    }),
  );

  return rows.map((r) => {
    const m = meta.get(r.contract_id as string);
    return {
      id: r.id as string,
      label: (r.label as string) || formatLabel(String(r.milestone_key)),
      amount: Number(r.amount),
      dueDate: (r.due_date as string | null) ?? null,
      eventName: m?.eventName ?? "—",
      customerName: m?.customerName ?? "—",
    };
  });
}

async function listDisputedOpenInvoices() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, due_date, total, status, customers(name), contracts(event_name)")
    .or("status.eq.disputed,disputed_at.not.is.null")
    .not("status", "in", '("void","canceled","draft","paid")');

  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => (r as { id: string }).id);
  const { data: apps, error: appErr } = await supabase
    .from("payment_applications")
    .select("invoice_id, amount")
    .in("invoice_id", ids);
  if (appErr) throw appErr;

  const paidByInv = new Map<string, number>();
  for (const a of apps ?? []) {
    const id = a.invoice_id as string;
    paidByInv.set(id, (paidByInv.get(id) ?? 0) + Number(a.amount));
  }

  return rows.map((row) => {
    const r = row as {
      id: string;
      invoice_number: string;
      due_date: string;
      total: number;
      customers?: { name: string } | { name: string }[] | null;
      contracts?: { event_name: string } | { event_name: string }[] | null;
    };
    const total = Number(r.total);
    const amountPaid = paidByInv.get(r.id) ?? 0;
    const customer = relOne(r.customers);
    const contract = relOne(r.contracts);
    return {
      invoiceId: r.id,
      invoiceNumber: r.invoice_number,
      dueDate: r.due_date,
      total,
      amountPaid,
      outstanding: Math.max(0, total - amountPaid),
      customerName: customer?.name ?? "—",
      eventName: contract?.event_name ?? "—",
    };
  }).filter((r) => r.outstanding > 0);
}

async function listPaymentApplicationTotals() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_applications")
    .select("payment_id, amount, invoices(invoice_number)");
  if (error) throw error;

  const map = new Map<
    string,
    { total: number; invoiceLabels: string[] }
  >();

  for (const row of data ?? []) {
    const r = row as {
      payment_id: string;
      amount: number;
      invoices?: { invoice_number: string } | { invoice_number: string }[] | null;
    };
    const cur = map.get(r.payment_id) ?? { total: 0, invoiceLabels: [] };
    cur.total += Number(r.amount);
    const inv = relOne(r.invoices);
    if (inv?.invoice_number) {
      cur.invoiceLabels.push(inv.invoice_number);
    }
    map.set(r.payment_id, cur);
  }

  return map;
}
