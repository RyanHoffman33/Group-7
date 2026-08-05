"use client";

import { useMemo, useState } from "react";
import type { AnalyticsMonth } from "@/features/analytics/seed";
import type { ForecastResult } from "@/features/analytics/forecast";
import { forecastSeries } from "@/features/analytics/forecast";
import { Money, Panel, StatCard } from "@/components/billing/ui";
import { ProjectionChart } from "@/components/analytics/ProjectionChart";
import { InsightCards } from "@/components/analytics/InsightCards";
import { formatCurrency } from "@/features/billing/aging";

type Scenario = "base" | "upside" | "downside";

function scaleForecast(base: ForecastResult, factor: number): ForecastResult {
  return {
    ...base,
    points: base.points.map((p) => ({
      ...p,
      revenue: Math.round(p.revenue * factor),
      cogs: Math.round(p.cogs * factor),
      margin: Math.round(p.margin * factor),
      revenueLow: Math.round(p.revenueLow * factor),
      revenueHigh: Math.round(p.revenueHigh * factor),
    })),
  };
}

export function ProjectionsClient({
  history,
  initialForecast,
  initialInsights,
  method,
  source,
}: {
  history: AnalyticsMonth[];
  initialForecast: ForecastResult;
  initialInsights: string[];
  method: string;
  source: string;
}) {
  const [scenario, setScenario] = useState<Scenario>("base");

  const forecast = useMemo(() => {
    const base =
      initialForecast.points.length > 0
        ? initialForecast
        : forecastSeries(history, 6);
    if (scenario === "upside") return scaleForecast(base, 1.08);
    if (scenario === "downside") return scaleForecast(base, 0.92);
    return base;
  }, [history, initialForecast, scenario]);

  const next3 = forecast.points.slice(0, 3);
  const next3Rev = next3.reduce((s, p) => s + p.revenue, 0);
  const next3Margin = next3.reduce((s, p) => s + p.margin, 0);
  const last3 = history.slice(-3);
  const last3Rev = last3.reduce((s, m) => s + m.revenue, 0);
  const vsActualPct =
    last3Rev > 0 ? ((next3Rev - last3Rev) / last3Rev) * 100 : null;

  return (
    <div>
      <p className="mb-4 text-xs text-[var(--muted)]">
        Model: {method} · Inputs: {source}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["base", "Base case"],
            ["upside", "Upside (+8%)"],
            ["downside", "Downside (−8%)"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScenario(id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              scenario === id
                ? "bg-[var(--ink)] text-white"
                : "border border-[var(--line)] hover:bg-[#f7f9fb]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Next 3 months revenue"
          value={formatCurrency(next3Rev)}
          hint={
            vsActualPct == null
              ? scenario === "base"
                ? "Point estimate"
                : `Scenario: ${scenario}`
              : `${vsActualPct >= 0 ? "+" : ""}${vsActualPct.toFixed(1)}% vs last 3 actual`
          }
          tone="accent"
        />
        <StatCard
          label="Projected margin (3 mo)"
          value={formatCurrency(next3Margin)}
          hint="Revenue − projected COGS"
        />
        <StatCard
          label="Revenue slope / mo"
          value={formatCurrency(forecast.revenueSlope)}
          hint={
            forecast.revenueSlope > 2000
              ? "Upward trend"
              : forecast.revenueSlope < -2000
                ? "Downward trend"
                : "Flat trend"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Projected revenue trend">
          <ProjectionChart history={history} forecast={forecast.points} />
        </Panel>
        <Panel title="Projected months">
          <ul className="divide-y divide-[var(--line)] text-sm">
            {forecast.points.map((p) => (
              <li
                key={p.month}
                className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{p.month.slice(0, 7)}</p>
                  <p className="text-xs text-[var(--muted)]">
                    ~{p.events} events · COGS{" "}
                    <span className="text-[#e11d48]">
                      <Money amount={p.cogs} />
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums text-[#2f9a57]">
                    <Money amount={p.revenue} />
                  </p>
                  <p
                    className={`text-[11px] tabular-nums ${
                      p.margin >= 0 ? "text-[#2f9a57]" : "text-[#e11d48]"
                    }`}
                  >
                    Margin <Money amount={p.margin} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="AI insights on this forecast">
          <InsightCards initialInsights={initialInsights} />
        </Panel>
      </div>
    </div>
  );
}
