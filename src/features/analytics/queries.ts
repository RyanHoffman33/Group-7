import { listMonthlyProfits, listEventProfits } from "@/features/profitability/queries";
import { getDashboardMetrics } from "@/features/billing/queries";
import { ANALYTICS_SEED_MONTHS, type AnalyticsMonth } from "./seed";
import { forecastSeries, type ForecastResult } from "./forecast";

export type AnalyticsBundle = {
  history: AnalyticsMonth[];
  forecast: ForecastResult;
  source: "live" | "seed";
  kpis: {
    trailingRevenue: number;
    trailingMargin: number;
    trailingMarginPct: number;
    avgEvents: number;
    arOutstanding: number;
    revenueGrowthPct: number | null;
  };
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("analytics timeout")), ms),
    ),
  ]);
}

function fromProfitMonths(
  months: Awaited<ReturnType<typeof listMonthlyProfits>>,
  arByMonthFallback: number,
): AnalyticsMonth[] {
  const lastIdx = months.length - 1;
  return months.map((m, i) => ({
    month: m.month.length === 7 ? `${m.month}-01` : m.month.slice(0, 10),
    revenue: m.recognized_revenue,
    cogs: m.direct_cogs,
    margin: m.net_margin,
    events: 0,
    // Point-in-time AR only on the latest month — avoid stamping current AR on history.
    arOutstanding: i === lastIdx ? arByMonthFallback : 0,
  }));
}

async function loadLiveHistory(): Promise<AnalyticsMonth[]> {
  const [months, events, metrics] = await Promise.all([
    listMonthlyProfits(),
    listEventProfits(),
    getDashboardMetrics().catch(() => null),
  ]);

  const arOut = metrics?.totalOutstanding ?? 0;

  let history = fromProfitMonths(months, arOut);

  // Approximate event counts per month from event start dates when available.
  if (events.length) {
    const counts = new Map<string, number>();
    for (const e of events) {
      const start = e.event_start ?? e.event_end;
      if (!start) continue;
      const key = `${start.slice(0, 7)}-01`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    history = history.map((h) => ({
      ...h,
      events: counts.get(h.month) ?? h.events,
    }));
  }

  if (history.length < 3) {
    throw new Error("insufficient live history");
  }
  return history.sort((a, b) => a.month.localeCompare(b.month));
}

export async function getAnalyticsBundle(): Promise<AnalyticsBundle> {
  let history: AnalyticsMonth[];
  let source: "live" | "seed" = "seed";

  try {
    history = await withTimeout(loadLiveHistory(), 3500);
    source = "live";
  } catch {
    history = ANALYTICS_SEED_MONTHS;
    source = "seed";
  }

  const forecast = forecastSeries(history, 6);
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
    history,
    forecast,
    source,
    kpis: {
      trailingRevenue,
      trailingMargin,
      trailingMarginPct,
      avgEvents,
      arOutstanding,
      revenueGrowthPct,
    },
  };
}

/** Deterministic offline insights when Gemini is unavailable. */
export function buildFallbackInsights(bundle: AnalyticsBundle): string[] {
  const { forecast, kpis, history } = bundle;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const slope = forecast.revenueSlope;
  const direction =
    slope > 2000 ? "upward" : slope < -2000 ? "downward" : "flat";

  const next3 = forecast.points.slice(0, 3);
  const nextRev = next3.reduce((s, p) => s + p.revenue, 0);
  const nextMargin = next3.reduce((s, p) => s + p.margin, 0);
  const last3 = history.slice(-3);
  const last3Rev = last3.reduce((s, m) => s + m.revenue, 0);
  const variancePct =
    last3Rev > 0 ? ((nextRev - last3Rev) / last3Rev) * 100 : null;

  const thinMarginMonths = history
    .filter((m) => m.revenue > 0 && m.margin / m.revenue < 0.12)
    .slice(-3);
  const costCreep =
    prev && last && last.revenue > 0 && prev.revenue > 0
      ? last.cogs / last.revenue - prev.cogs / prev.revenue
      : null;

  const tips: string[] = [];

  tips.push(
    `Trend is ${direction} (≈$${Math.round(Math.abs(slope)).toLocaleString()}/mo slope). Next quarter revenue outlook ~$${Math.round(nextRev).toLocaleString()} with ~$${Math.round(nextMargin).toLocaleString()} projected margin.`,
  );

  if (variancePct != null) {
    tips.push(
      variancePct >= 0
        ? `Projected next 3 months are ${variancePct.toFixed(1)}% above the last 3 months of actual revenue — check capacity and staffing before locking spend.`
        : `Projected next 3 months are ${Math.abs(variancePct).toFixed(1)}% below the last 3 months of actuals — review pipeline and change-order backlog.`,
    );
  }

  if (kpis.revenueGrowthPct != null) {
    const g = kpis.revenueGrowthPct * 100;
    tips.push(
      g >= 0
        ? `Trailing half outpaced the prior half by ${g.toFixed(1)}% ($${Math.round(kpis.trailingRevenue).toLocaleString()} recognized).`
        : `Trailing half lagged the prior half by ${Math.abs(g).toFixed(1)}% — investigate canceled or delayed events.`,
    );
  }

  if (thinMarginMonths.length) {
    tips.push(
      `Margin pressure in ${thinMarginMonths.map((m) => m.month.slice(0, 7)).join(", ")} (under 12% on recognized revenue). Treat those months as at-risk for cost overruns.`,
    );
  } else if (kpis.trailingMarginPct < 0.15) {
    tips.push(
      `Blended trailing margin is only ${(kpis.trailingMarginPct * 100).toFixed(1)}% — below a healthy 15% floor for event production.`,
    );
  }

  if (costCreep != null && costCreep > 0.02) {
    tips.push(
      `COGS ratio rose ${(costCreep * 100).toFixed(1)} pts month-over-month — projected costs may outrun revenue unless commitments are tightened.`,
    );
  }

  if (last && last.arOutstanding > kpis.trailingRevenue * 0.45 && kpis.trailingRevenue > 0) {
    tips.push(
      `A/R ($${Math.round(last.arOutstanding).toLocaleString()}) is high vs trailing revenue — collections risk can erase projected margin even if bookings look strong.`,
    );
  }

  if (forecast.points.length >= 2) {
    const first = forecast.points[0];
    const lastF = forecast.points[forecast.points.length - 1];
    const bandWidth = lastF.revenueHigh - lastF.revenueLow;
    const conf = forecast.confidence;
    tips.push(
      `Forecast confidence is ${conf.label} (${conf.score}%); the ${Math.round(conf.intervalLevel * 100)}% band widens to ±$${Math.round(bandWidth / 2).toLocaleString()} by ${lastF.month.slice(0, 7)} — near-term ${first.month.slice(0, 7)} is the more actionable planning month.`,
    );
  }

  return tips.slice(0, 6);
}
