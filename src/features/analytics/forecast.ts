import type { AnalyticsMonth } from "./seed";

export type ForecastPoint = {
  month: string;
  revenue: number;
  cogs: number;
  margin: number;
  events: number;
  revenueLow: number;
  revenueHigh: number;
};

export type ForecastResult = {
  method: string;
  horizonMonths: number;
  points: ForecastPoint[];
  /** Slope of revenue OLS (per calendar month). */
  revenueSlope: number;
  rmse: number;
};

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return monthKey(d);
}

/** Months since year 0 (UTC) — continuous calendar x-axis for OLS. */
function monthIndex(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function monthOfYear(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCMonth();
}

/** Ordinary least squares: y ~ a + b*x */
function ols(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  if (n === 0) return { a: 0, b: 0 };
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  const a = meanY - b * meanX;
  return { a, b };
}

function rmseOf(xs: number[], ys: number[], a: number, b: number): number {
  if (ys.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < ys.length; i++) {
    const pred = a + b * xs[i];
    sum += (ys[i] - pred) ** 2;
  }
  return Math.sqrt(sum / ys.length);
}

function mean(vals: number[]): number {
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/**
 * Trailing average of positive observations (ignores recognition-lag zeros
 * that would otherwise drag a linear trend to $0).
 */
function positiveTrailingMean(values: number[], window = 6): number {
  const pos = values.filter((v) => v > 0);
  if (!pos.length) return 0;
  return mean(pos.slice(-window));
}

type FitRow = {
  month: string;
  x: number;
  revenue: number;
  cogs: number;
  events: number;
};

/**
 * Trend (+ optional seasonal) projection for the next `horizon` months.
 *
 * Robust to trailing zero-revenue months (common when costs post before
 * recognition): fits primarily on positive-revenue months, damps steep
 * declines, and floors projections near the recent positive run-rate.
 */
export function forecastSeries(
  history: AnalyticsMonth[],
  horizon = 6,
): ForecastResult {
  const series = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const n = series.length;
  if (n === 0) {
    return {
      method: "insufficient data",
      horizonMonths: horizon,
      points: [],
      revenueSlope: 0,
      rmse: 0,
    };
  }

  const baselineRev = positiveTrailingMean(series.map((m) => m.revenue));
  const baselineCogs = positiveTrailingMean(series.map((m) => m.cogs));
  const baselineEvents = positiveTrailingMean(series.map((m) => m.events));

  // Fit on positive-revenue months when available; otherwise use full series.
  let fitRows: FitRow[] = series
    .filter((m) => m.revenue > 0)
    .map((m) => ({
      month: m.month,
      x: monthIndex(m.month),
      revenue: m.revenue,
      cogs: m.cogs,
      events: m.events,
    }));

  if (fitRows.length < 2) {
    fitRows = series.map((m) => ({
      month: m.month,
      x: monthIndex(m.month),
      revenue: m.revenue,
      cogs: m.cogs,
      events: m.events,
    }));
  }

  // Relative calendar months from the first fit point (avoids huge intercepts).
  const x0 = fitRows[0].x;
  for (const row of fitRows) {
    row.x = row.x - x0;
  }

  const fitXs = fitRows.map((r) => r.x);
  const fitRev = fitRows.map((r) => r.revenue);
  const fitCogs = fitRows.map((r) => r.cogs);
  const fitEvt = fitRows.map((r) => r.events);

  const useSeasonal = fitRows.length >= 12;
  let method =
    baselineRev > 0
      ? "damped trend + positive run-rate floor"
      : "linear trend (OLS)";
  let seasonalRev = Array(12).fill(1) as number[];
  let seasonalCogs = Array(12).fill(1) as number[];
  let seasonalEvents = Array(12).fill(1) as number[];

  if (useSeasonal) {
    method = "deseasonalized damped trend + month-of-year factors";
    const revFit0 = ols(fitXs, fitRev);
    const cogsFit0 = ols(fitXs, fitCogs);
    const evtFit0 = ols(fitXs, fitEvt);
    const bucketsRev: number[][] = Array.from({ length: 12 }, () => []);
    const bucketsCogs: number[][] = Array.from({ length: 12 }, () => []);
    const bucketsEvt: number[][] = Array.from({ length: 12 }, () => []);
    for (const row of fitRows) {
      const mi = monthOfYear(row.month);
      const trendR = revFit0.a + revFit0.b * row.x;
      const trendC = cogsFit0.a + cogsFit0.b * row.x;
      const trendE = evtFit0.a + evtFit0.b * row.x;
      if (trendR > 0) bucketsRev[mi].push(row.revenue / trendR);
      if (trendC > 0) bucketsCogs[mi].push(row.cogs / trendC);
      if (trendE > 0) bucketsEvt[mi].push(row.events / trendE);
    }
    seasonalRev = bucketsRev.map((b) => (b.length ? mean(b) : 1));
    seasonalCogs = bucketsCogs.map((b) => (b.length ? mean(b) : 1));
    seasonalEvents = bucketsEvt.map((b) => (b.length ? mean(b) : 1));
  }

  const deseasRev = fitRows.map((r) => {
    const f = seasonalRev[monthOfYear(r.month)] || 1;
    return f === 0 ? r.revenue : r.revenue / f;
  });
  const deseasCogs = fitRows.map((r) => {
    const f = seasonalCogs[monthOfYear(r.month)] || 1;
    return f === 0 ? r.cogs : r.cogs / f;
  });
  const deseasEvt = fitRows.map((r) => {
    const f = seasonalEvents[monthOfYear(r.month)] || 1;
    return f === 0 ? r.events : r.events / f;
  });

  const revModel = ols(fitXs, deseasRev);
  const cogsModel = ols(fitXs, deseasCogs);
  const evtModel = ols(fitXs, deseasEvt);
  const rmse = rmseOf(fitXs, deseasRev, revModel.a, revModel.b);

  // Cap how fast revenue can fall month-over-month (recognition lag protection).
  const maxDeclinePerMonth = baselineRev > 0 ? baselineRev * 0.04 : Infinity;
  const dampedRevB =
    baselineRev > 0 ? Math.max(revModel.b, -maxDeclinePerMonth) : revModel.b;
  const dampedCogsB =
    baselineCogs > 0
      ? Math.max(cogsModel.b, -baselineCogs * 0.04)
      : cogsModel.b;

  const last = series[n - 1].month;
  // Forecast x continues from last history month on the same relative scale.
  const lastRelX = monthIndex(last) - x0;
  const revFloor = baselineRev > 0 ? baselineRev * 0.7 : 0;
  const cogsFloor = baselineCogs > 0 ? baselineCogs * 0.55 : 0;
  const evtFloor = baselineEvents > 0 ? baselineEvents * 0.6 : 0;

  const points: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const idx = lastRelX + h;
    const month = addMonths(last, h);
    const mi = monthOfYear(month);
    const seasonR = seasonalRev[mi] || 1;
    const seasonC = seasonalCogs[mi] || 1;
    const seasonE = seasonalEvents[mi] || 1;

    let revenue = (revModel.a + dampedRevB * idx) * seasonR;
    let cogsVal = (cogsModel.a + dampedCogsB * idx) * seasonC;
    let eventsVal = (evtModel.a + evtModel.b * idx) * seasonE;

    if (baselineRev > 0) {
      revenue = Math.max(revenue, revFloor);
      if (revenue < baselineRev) {
        revenue = revenue * 0.7 + baselineRev * 0.3;
      }
    } else {
      revenue = Math.max(0, revenue);
    }

    if (baselineCogs > 0) {
      cogsVal = Math.max(cogsVal, cogsFloor);
      if (cogsVal < baselineCogs) {
        cogsVal = cogsVal * 0.7 + baselineCogs * 0.3;
      }
    } else {
      cogsVal = Math.max(0, cogsVal);
    }

    eventsVal =
      baselineEvents > 0
        ? Math.max(eventsVal, evtFloor)
        : Math.max(0, eventsVal);

    const band = Math.max(rmse * 1.28, revenue * 0.08, baselineRev * 0.05);
    points.push({
      month,
      revenue: Math.round(revenue),
      cogs: Math.round(cogsVal),
      margin: Math.round(revenue - cogsVal),
      events: Math.max(0, Math.round(eventsVal)),
      revenueLow: Math.round(Math.max(0, revenue - band)),
      revenueHigh: Math.round(revenue + band),
    });
  }

  return {
    method,
    horizonMonths: horizon,
    points,
    revenueSlope: dampedRevB,
    rmse,
  };
}
