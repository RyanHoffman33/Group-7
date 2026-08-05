/**
 * Lightweight golden / invariant checks (no Jest/Vitest in package.json).
 * Run: npx tsx src/features/analytics/forecast.selfcheck.ts
 */
import { ANALYTICS_SEED_MONTHS } from "./seed";
import { forecastSeries, __forecastInternals as F } from "./forecast";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Huber should down-weight a single huge outlier vs OLS.
{
  const xs = [0, 1, 2, 3, 4, 5];
  const ys = [10, 12, 14, 16, 18, 200];
  const o = F.ols(xs, ys);
  const h = F.huberRegression(xs, ys);
  assert(Math.abs(h.b) < Math.abs(o.b), "Huber slope should be smaller than OLS with outlier");
}

// Holt damped with flat series stays near level.
{
  const y = [100, 100, 100, 100, 100];
  const { path } = F.holtDampedForecast(y, 3, { phi: 0.9 });
  assert(path.every((p) => Math.abs(p - 100) < 5), "Holt flat series ~100");
}

// Croston returns positive rate on intermittent demand.
{
  const y = [0, 50, 0, 0, 60, 0, 0, 55];
  const path = F.crostonTsbForecast(y, 3);
  assert(path.every((p) => p > 0), "Croston path positive");
}

// Seed forecast: non-negative, finite, 6 points, not collapsed to ~0.
{
  const f = forecastSeries(ANALYTICS_SEED_MONTHS, 6);
  assert(f.points.length === 6, "horizon 6");
  assert(f.points.every((p) => p.revenue >= 0 && p.cogs >= 0), "non-negative");
  assert(f.points.every((p) => p.revenueLow <= p.revenue && p.revenue <= p.revenueHigh), "bands");
  const avg = f.points.reduce((s, p) => s + p.revenue, 0) / 6;
  assert(avg > 150000, `seed forecast should stay near run-rate, got ${avg}`);
  assert(f.method.includes("ensemble"), `method label: ${f.method}`);
}

// Trailing near-zero months must not force forever-zero forecasts.
{
  const laggy = [
    ...ANALYTICS_SEED_MONTHS.slice(0, 10),
    {
      month: "2026-06-01",
      revenue: 0,
      cogs: 50000,
      margin: -50000,
      events: 0,
      arOutstanding: 0,
    },
    {
      month: "2026-07-01",
      revenue: 0,
      cogs: 40000,
      margin: -40000,
      events: 0,
      arOutstanding: 0,
    },
  ];
  const f = forecastSeries(laggy, 4);
  assert(
    f.points.every((p) => p.revenue > 50000),
    `lag zeros must not zero-out projections: ${f.points.map((p) => p.revenue)}`,
  );
}

console.log("forecast.selfcheck: all passed");
