/**
 * Display strings for the profitability pages. Labels only — no math.
 */

export const exceptionMeta: Record<
  string,
  { title: string; risk: string; tone: "warn" | "danger" | "accent" }
> = {
  missed_billing_earned_not_billed: {
    title: "Missed billing",
    risk: "Work is finished but a material balance was never invoiced — revenue we earned and may simply forget to collect.",
    tone: "danger",
  },
  deposit_limbo_on_cancellation: {
    title: "Deposit limbo on cancellation",
    risk: "A canceled event still holds a customer deposit that was neither refunded nor recognized — a GAAP gap and a control finding.",
    tone: "danger",
  },
  canceled_with_unrecovered_costs: {
    title: "Canceled with unrecovered costs",
    risk: "The event was canceled after we incurred real costs, and the cancellation fee or deposit forfeit was never booked as revenue.",
    tone: "danger",
  },
  negative_margin: {
    title: "Negative margin",
    risk: "Direct costs exceed recognized revenue — this event is losing money as booked today.",
    tone: "danger",
  },
  thin_margin: {
    title: "Thin margin",
    risk: "A finished event closed below a 10% gross margin — worth a look at pricing or cost control before we run this event type again.",
    tone: "warn",
  },
  over_budget: {
    title: "Over budget",
    risk: "Actual costs have passed the total budget set for this event.",
    tone: "warn",
  },
  flagged_cost_entry: {
    title: "Flagged cost entry",
    risk: "The cost-tracking module flagged this entry (late, duplicate, over-committed, or entered after billing) — its amount is in our numbers until resolved.",
    tone: "warn",
  },
  recognized_without_evidence: {
    title: "Recognized without evidence",
    risk: "Revenue is recognized on this invoice but no ASC 606 evidence is on file — an audit-readiness gap owned jointly with GAAP compliance.",
    tone: "warn",
  },
  reimbursable_with_markup: {
    title: "Pass-through with markup",
    risk: "A cost is flagged as reimbursable pass-through but carries a markup — the principal-vs-agent (gross vs net) treatment is inconsistent.",
    tone: "warn",
  },
  suspected_duplicate_cost: {
    title: "Suspected duplicate cost",
    risk: "Two cost sources recorded similar amounts for this event; both are currently counted (conservative) pending human review.",
    tone: "accent",
  },
};

export function exceptionTitle(type: string): string {
  return exceptionMeta[type]?.title ?? type.replaceAll("_", " ");
}

export const statusTone: Record<
  string,
  "neutral" | "ok" | "warn" | "danger" | "accent"
> = {
  draft: "neutral",
  pending_approval: "neutral",
  deposit_pending: "warn",
  active: "accent",
  completed: "ok",
  closed: "ok",
  canceled: "danger",
};

export function categoryLabel(category: string): string {
  if (category === "billable_costs (classified)") {
    return "Rebillable costs (GAAP-classified)";
  }
  return category.charAt(0).toUpperCase() + category.slice(1).replaceAll("_", " ");
}

export function formatMonth(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function formatPct(pct: number | null): string {
  return pct == null ? "—" : `${pct.toFixed(1)}%`;
}
