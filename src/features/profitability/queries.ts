import { createClient } from "@/lib/supabase/server";

/**
 * Profitability module reads.
 *
 * Every number on the /profitability pages comes from the seven v_profit_*
 * views. No margin, dedup, classification, or recognition logic is
 * re-implemented here — the only arithmetic below is summing already-computed
 * view columns for portfolio headline cards (same pattern as
 * features/gaap/getPositionTotals).
 */

function num(v: unknown): number {
  return Number(v ?? 0);
}

export type EventProfit = {
  contract_id: string;
  contract_number: string | null;
  customer_id: string;
  customer_name: string;
  event_name: string;
  event_type: string | null;
  event_start: string | null;
  event_end: string | null;
  status: string;
  canceled_at: string | null;
  billing_method: string | null;
  project_manager_label: string | null;
  contract_value: number;
  recognized_revenue: number;
  direct_cogs: number;
  gross_margin: number;
  gross_margin_pct: number | null;
  reimbursable_passthrough: number;
  selling_and_period_expenses: number;
  overhead_allocated_entries: number;
  committed_cost_open: number;
  budget_total: number | null;
  actual_cost_total: number;
  budget_remaining: number;
  earned_to_date: number;
  billed_to_date: number;
  earned_not_billed: number;
};

export type MonthlyProfit = {
  month: string;
  recognized_revenue: number;
  direct_cogs: number;
  gross_margin: number;
  reimbursable_passthrough: number;
  period_expenses: number;
  net_margin: number;
};

export type ProfitException = {
  exception_type: string;
  contract_id: string;
  event_name: string;
  ref_id: string | null;
  detail: string;
  amount: number | null;
};

export type OverheadAllocation = {
  contract_id: string;
  event_name: string;
  recognized_revenue: number;
  gross_margin: number;
  allocated_overhead: number;
  fully_loaded_margin: number;
  total_overhead_pool: number;
};

function mapEvent(r: Record<string, unknown>): EventProfit {
  return {
    ...(r as EventProfit),
    contract_value: num(r.contract_value),
    recognized_revenue: num(r.recognized_revenue),
    direct_cogs: num(r.direct_cogs),
    gross_margin: num(r.gross_margin),
    gross_margin_pct:
      r.gross_margin_pct == null ? null : num(r.gross_margin_pct),
    reimbursable_passthrough: num(r.reimbursable_passthrough),
    selling_and_period_expenses: num(r.selling_and_period_expenses),
    overhead_allocated_entries: num(r.overhead_allocated_entries),
    committed_cost_open: num(r.committed_cost_open),
    budget_total: r.budget_total == null ? null : num(r.budget_total),
    actual_cost_total: num(r.actual_cost_total),
    budget_remaining: num(r.budget_remaining),
    earned_to_date: num(r.earned_to_date),
    billed_to_date: num(r.billed_to_date),
    earned_not_billed: num(r.earned_not_billed),
  };
}

export async function listEventProfits(): Promise<EventProfit[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_profit_event")
    .select("*")
    .order("event_name");
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function getEventProfit(
  contractId: string,
): Promise<EventProfit | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_profit_event")
    .select("*")
    .eq("contract_id", contractId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapEvent(data) : null;
}

export async function listMonthlyProfits(): Promise<MonthlyProfit[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_profit_monthly")
    .select("*")
    .order("month");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    month: String(r.month),
    recognized_revenue: num(r.recognized_revenue),
    direct_cogs: num(r.direct_cogs),
    gross_margin: num(r.gross_margin),
    reimbursable_passthrough: num(r.reimbursable_passthrough),
    period_expenses: num(r.period_expenses),
    net_margin: num(r.net_margin),
  }));
}

export async function listExceptions(
  contractId?: string,
): Promise<ProfitException[]> {
  const supabase = createClient();
  let q = supabase.from("v_profit_exceptions").select("*");
  if (contractId) q = q.eq("contract_id", contractId);
  const { data, error } = await q.order("exception_type");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    exception_type: String(r.exception_type),
    contract_id: String(r.contract_id),
    event_name: String(r.event_name),
    ref_id: (r.ref_id as string) ?? null,
    detail: String(r.detail ?? ""),
    amount: r.amount == null ? null : num(r.amount),
  }));
}

export async function getOverheadAllocation(
  contractId: string,
): Promise<OverheadAllocation | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_profit_overhead_allocation")
    .select("*")
    .eq("contract_id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    contract_id: String(data.contract_id),
    event_name: String(data.event_name),
    recognized_revenue: num(data.recognized_revenue),
    gross_margin: num(data.gross_margin),
    allocated_overhead: num(data.allocated_overhead),
    fully_loaded_margin: num(data.fully_loaded_margin),
    total_overhead_pool: num(data.total_overhead_pool),
  };
}

export type BudgetVsActual = {
  contract_id: string;
  event_name: string;
  category: string;
  budgeted_amount: number;
  actual_amount: number;
  committed_amount: number;
  variance: number;
  over_budget: boolean;
};

export async function listBudgetVsActual(
  contractId: string,
): Promise<BudgetVsActual[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_profit_budget_vs_actual")
    .select("*")
    .eq("contract_id", contractId)
    .order("category");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    contract_id: String(r.contract_id),
    event_name: String(r.event_name),
    category: String(r.category),
    budgeted_amount: num(r.budgeted_amount),
    actual_amount: num(r.actual_amount),
    committed_amount: num(r.committed_amount),
    variance: num(r.variance),
    over_budget: Boolean(r.over_budget),
  }));
}

/** Portfolio headline numbers — sums of view outputs only. */
export async function getPortfolioTotals(
  events?: EventProfit[],
  exceptions?: ProfitException[],
) {
  const rows = events ?? (await listEventProfits());
  const flags = exceptions ?? (await listExceptions());
  const revenue = rows.reduce((s, r) => s + r.recognized_revenue, 0);
  const margin = rows.reduce((s, r) => s + r.gross_margin, 0);
  return {
    recognizedRevenue: revenue,
    grossMargin: margin,
    blendedMarginPct: revenue > 0 ? (margin / revenue) * 100 : null,
    eventsOverBudget: new Set(
      flags
        .filter((f) => f.exception_type === "over_budget")
        .map((f) => f.contract_id),
    ).size,
    openExceptions: flags.length,
  };
}
