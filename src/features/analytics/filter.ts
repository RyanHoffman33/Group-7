import type { AnalyticsMonth } from "./seed";

export type AnalyticsPeriodFilter = {
  year: string; // "all" | "2025" | "2026"
  quarter: string; // "all" | "1" | "2" | "3" | "4"
  month: string; // "all" | "1" … "12"
};

export function defaultAnalyticsFilter(
  history: AnalyticsMonth[],
): AnalyticsPeriodFilter {
  const last = history[history.length - 1];
  const year = last ? String(new Date(`${last.month}T00:00:00Z`).getUTCFullYear()) : "all";
  return { year, quarter: "all", month: "all" };
}

export function yearsFromHistory(history: AnalyticsMonth[]): number[] {
  const set = new Set(
    history.map((m) => new Date(`${m.month}T00:00:00Z`).getUTCFullYear()),
  );
  return [...set].sort((a, b) => b - a);
}

export function filterAnalyticsHistory(
  history: AnalyticsMonth[],
  filter: AnalyticsPeriodFilter,
): AnalyticsMonth[] {
  return history.filter((m) => {
    const d = new Date(`${m.month}T00:00:00Z`);
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth() + 1;
    const q = Math.ceil(mo / 3);

    if (filter.year !== "all" && y !== Number(filter.year)) return false;
    if (filter.quarter !== "all" && q !== Number(filter.quarter)) return false;
    if (filter.month !== "all" && mo !== Number(filter.month)) return false;
    return true;
  });
}

export function kpisFromHistory(history: AnalyticsMonth[]) {
  const last6 = history.slice(-6);
  const prev6 = history.slice(-12, -6);
  const trailingRevenue = last6.reduce((s, m) => s + m.revenue, 0);
  const trailingMargin = last6.reduce((s, m) => s + m.margin, 0);
  const trailingMarginPct =
    trailingRevenue === 0 ? 0 : trailingMargin / trailingRevenue;
  const avgEvents =
    last6.length === 0
      ? 0
      : last6.reduce((s, m) => s + m.events, 0) / last6.length;
  const arOutstanding = history[history.length - 1]?.arOutstanding ?? 0;
  const prevRev = prev6.reduce((s, m) => s + m.revenue, 0);
  const revenueGrowthPct =
    prev6.length && prevRev > 0
      ? (trailingRevenue - prevRev) / prevRev
      : null;
  return {
    trailingRevenue,
    trailingMargin,
    trailingMarginPct,
    avgEvents,
    arOutstanding,
    revenueGrowthPct,
  };
}
