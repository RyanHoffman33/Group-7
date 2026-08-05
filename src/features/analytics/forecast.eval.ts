/**
 * Holdout / walk-forward evaluation of forecastSeries vs a legacy OLS baseline.
 * Run: npx tsx src/features/analytics/forecast.eval.ts
 */
import { ANALYTICS_SEED_MONTHS, type AnalyticsMonth } from "./seed";
import {
  forecastSeries,
  __forecastInternals as F,
} from "./forecast";

/** Legacy damped OLS + run-rate floor (pre-ensemble) for comparison. */
function legacyForecast(
  history: AnalyticsMonth[],
  horizon: number,
): number[] {
  const series = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const n = series.length;
  if (!n) return Array(horizon).fill(0);

  const monthIndex = (iso: string) => {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
  };
  const addMonths = (iso: string, k: number) => {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + k);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  };
  const monthOfYear = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCMonth();
  const mean = (vals: number[]) =>
    vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  const baselineRev = F.positiveTrailingMean(series.map((m) => m.revenue));

  let fitRows = series
    .filter((m) => m.revenue > 0)
    .map((m) => ({
      month: m.month,
      x: monthIndex(m.month),
      revenue: m.revenue,
    }));
  if (fitRows.length < 2) {
    fitRows = series.map((m) => ({
      month: m.month,
      x: monthIndex(m.month),
      revenue: m.revenue,
    }));
  }
  const x0 = fitRows[0].x;
  for (const row of fitRows) row.x -= x0;

  const useSeasonal = fitRows.length >= 12;
  let seasonal = Array(12).fill(1) as number[];
  if (useSeasonal) {
    const fit0 = F.ols(
      fitRows.map((r) => r.x),
      fitRows.map((r) => r.revenue),
    );
    const buckets: number[][] = Array.from({ length: 12 }, () => []);
    for (const row of fitRows) {
      const trend = fit0.a + fit0.b * row.x;
      if (trend > 0) buckets[monthOfYear(row.month)].push(row.revenue / trend);
    }
    seasonal = buckets.map((b) => (b.length ? mean(b) : 1));
  }

  const deseas = fitRows.map((r) => {
    const f = seasonal[monthOfYear(r.month)] || 1;
    return f === 0 ? r.revenue : r.revenue / f;
  });
  const model = F.ols(
    fitRows.map((r) => r.x),
    deseas,
  );
  const maxDecline = baselineRev > 0 ? baselineRev * 0.04 : Infinity;
  const b =
    baselineRev > 0 ? Math.max(model.b, -maxDecline) : model.b;
  const last = series[n - 1].month;
  const lastRelX = monthIndex(last) - x0;
  const revFloor = baselineRev > 0 ? baselineRev * 0.7 : 0;
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const month = addMonths(last, h);
    let revenue =
      (model.a + b * (lastRelX + h)) * (seasonal[monthOfYear(month)] || 1);
    if (baselineRev > 0) {
      revenue = Math.max(revenue, revFloor);
      if (revenue < baselineRev) revenue = revenue * 0.7 + baselineRev * 0.3;
    } else {
      revenue = Math.max(0, revenue);
    }
    out.push(revenue);
  }
  return out;
}

const LIVE_SERIES: AnalyticsMonth[] = [
  { month: "2025-08-01", revenue: 40000, cogs: 9200, margin: 29900, events: 0, arOutstanding: 0 },
  { month: "2025-09-01", revenue: 95800, cogs: 5400, margin: 90400, events: 0, arOutstanding: 0 },
  { month: "2025-10-01", revenue: 25200, cogs: 41900, margin: -18300, events: 0, arOutstanding: 0 },
  { month: "2025-11-01", revenue: 55000, cogs: 9300, margin: 45700, events: 0, arOutstanding: 0 },
  { month: "2025-12-01", revenue: 20800, cogs: 5510, margin: 15290, events: 0, arOutstanding: 0 },
  { month: "2026-01-01", revenue: 21000, cogs: 4100, margin: 16900, events: 0, arOutstanding: 0 },
  { month: "2026-02-01", revenue: 38200, cogs: 22100, margin: 16100, events: 0, arOutstanding: 0 },
  { month: "2026-03-01", revenue: 21000, cogs: 46200, margin: -25200, events: 0, arOutstanding: 0 },
  { month: "2026-06-01", revenue: 20000, cogs: 4200, margin: 15800, events: 0, arOutstanding: 0 },
  { month: "2026-07-01", revenue: 0, cogs: 22960, margin: -28710, events: 0, arOutstanding: 0 },
  { month: "2026-08-01", revenue: 2500, cogs: 37515, margin: -38315, events: 0, arOutstanding: 0 },
];

function walkForward(
  history: AnalyticsMonth[],
  holdout: number,
  predict: (train: AnalyticsMonth[], h: number) => number[],
): { mape: number; rmse: number; preds: number[]; actuals: number[] } {
  const n = history.length;
  const trainEnd = n - holdout;
  if (trainEnd < 3) {
    return { mape: Infinity, rmse: Infinity, preds: [], actuals: [] };
  }
  const train = history.slice(0, trainEnd);
  const actuals = history.slice(trainEnd).map((m) => m.revenue);
  const preds = predict(train, holdout);
  return {
    mape: F.mapeVec(actuals, preds),
    rmse: F.rmseVec(actuals, preds),
    preds,
    actuals,
  };
}

function report(name: string, history: AnalyticsMonth[], holdout: number) {
  const ens = walkForward(history, holdout, (t, h) =>
    forecastSeries(t, h).points.map((p) => p.revenue),
  );
  const leg = walkForward(history, holdout, (t, h) => legacyForecast(t, h));
  console.log(`\n=== ${name} (holdout ${holdout} mo) ===`);
  console.log(
    `Legacy OLS  MAPE=${(leg.mape * 100).toFixed(1)}%  RMSE=${leg.rmse.toFixed(0)}`,
  );
  console.log(
    `Ensemble    MAPE=${(ens.mape * 100).toFixed(1)}%  RMSE=${ens.rmse.toFixed(0)}`,
  );
  console.log(
    `Actuals: ${ens.actuals.map((v) => Math.round(v)).join(", ")}`,
  );
  console.log(
    `Ensemble: ${ens.preds.map((v) => Math.round(v)).join(", ")}`,
  );
  console.log(
    `Legacy:   ${leg.preds.map((v) => Math.round(v)).join(", ")}`,
  );
  const method = forecastSeries(history, 6).method;
  console.log(`Full-series method: ${method}`);
  return { ens, leg };
}

const seed3 = report("SEED series", ANALYTICS_SEED_MONTHS, 3);
const seed6 = report("SEED series", ANALYTICS_SEED_MONTHS, 6);
const live3 = report("LIVE v_profit_monthly", LIVE_SERIES, 3);

const seedWin =
  seed3.ens.mape <= seed3.leg.mape || seed6.ens.rmse <= seed6.leg.rmse;
const liveWin = live3.ens.mape <= live3.leg.mape * 1.05; // allow tiny noise

console.log("\n--- Summary ---");
console.log(
  seedWin
    ? "SEED: ensemble competitive/better vs legacy"
    : "SEED: ensemble worse — inspect",
);
console.log(
  liveWin
    ? "LIVE: ensemble competitive/better vs legacy"
    : "LIVE: ensemble worse — inspect",
);

if (!seedWin && !liveWin) {
  process.exitCode = 1;
}
