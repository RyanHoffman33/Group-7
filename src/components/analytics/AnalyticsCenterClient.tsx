"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatPercent } from "@/features/billing/aging";
import type { AnalyticsBundle } from "@/features/analytics/queries";
import { buildFallbackInsights } from "@/features/analytics/queries";
import { forecastSeries } from "@/features/analytics/forecast";
import {
  defaultAnalyticsFilter,
  filterAnalyticsHistory,
  kpisFromHistory,
  yearsFromHistory,
  type AnalyticsPeriodFilter,
} from "@/features/analytics/filter";
import { PageHeader, Panel, StatCard } from "@/components/billing/ui";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ChartLegend } from "@/components/analytics/ChartLegend";
import { HistoryCharts } from "@/components/analytics/HistoryCharts";
import { ProjectionChart } from "@/components/analytics/ProjectionChart";
import { InsightCards } from "@/components/analytics/InsightCards";

export function AnalyticsCenterClient({
  bundle,
  showProfitabilityLinks,
}: {
  bundle: AnalyticsBundle;
  showProfitabilityLinks: boolean;
}) {
  const years = useMemo(() => yearsFromHistory(bundle.history), [bundle.history]);
  const [filter, setFilter] = useState<AnalyticsPeriodFilter>(() =>
    defaultAnalyticsFilter(bundle.history),
  );

  const filteredHistory = useMemo(
    () => filterAnalyticsHistory(bundle.history, filter),
    [bundle.history, filter],
  );

  const forecast = useMemo(
    // Always project from full history — year/quarter filters must not
    // starve the model down to lag-zero months (which forecast as $0).
    () => forecastSeries(bundle.history, 6),
    [bundle.history],
  );

  const kpis = useMemo(
    () =>
      kpisFromHistory(
        filteredHistory.length ? filteredHistory : bundle.history,
      ),
    [filteredHistory, bundle.history],
  );

  const insights = useMemo(
    () =>
      buildFallbackInsights({
        history: filteredHistory.length ? filteredHistory : bundle.history,
        forecast,
        source: bundle.source,
        kpis,
      }),
    [filteredHistory, forecast, bundle.source, kpis],
  );

  const chartHistory =
    filteredHistory.length > 0 ? filteredHistory : bundle.history;

  return (
    <div>
      <PageHeader title="Analytics Center" />

      <p className="mb-3 text-xs text-[var(--muted)]">
        Data source:{" "}
        <span className="font-medium text-[var(--ink)]">
          {bundle.source === "live"
            ? "Live profitability / billing views"
            : "Demo seed series (live timeout or empty)"}
        </span>
        {" · "}
        <Link href="/analytics/history" className="text-[var(--accent)] hover:underline">
          History
        </Link>
        {" · "}
        <Link
          href="/analytics/projections"
          className="text-[var(--accent)] hover:underline"
        >
          Projections
        </Link>
        {showProfitabilityLinks ? (
          <>
            {" · "}
            <Link href="/profitability" className="text-[var(--accent)] hover:underline">
              Profitability
            </Link>
            {" · "}
            <Link
              href="/profitability/exceptions"
              className="text-[var(--accent)] hover:underline"
            >
              Exceptions
            </Link>
          </>
        ) : null}
      </p>

      <div className="mb-4">
        <AnalyticsFilters years={years} value={filter} onChange={setFilter} />
      </div>

      <div className="mb-3">
        <ChartLegend variant="full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Trailing 6-mo revenue"
          value={formatCurrency(kpis.trailingRevenue)}
          hint="Within filtered series (last 6 pts)"
          tone="accent"
        />
        <StatCard
          label="Trailing margin"
          value={formatPercent(kpis.trailingMarginPct)}
          hint={formatCurrency(kpis.trailingMargin)}
        />
        <StatCard
          label="Avg events / month"
          value={kpis.avgEvents.toFixed(1)}
          hint={`${chartHistory.length} months in view`}
        />
        <StatCard
          label="A/R outstanding"
          value={formatCurrency(kpis.arOutstanding)}
          hint={
            kpis.revenueGrowthPct == null
              ? "Latest in filter"
              : `Rev Δ ${(kpis.revenueGrowthPct * 100).toFixed(1)}% vs prior 6`
          }
          tone={kpis.arOutstanding > 140000 ? "warn" : "default"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Recent history">
          <HistoryCharts months={chartHistory} showLegend={false} />
        </Panel>
        <Panel title="Projection preview (line)">
          <ProjectionChart
            history={bundle.history.slice(-12)}
            forecast={forecast.points}
            showLegend={false}
            confidence={forecast.confidence}
          />
          <p className="mt-3 text-xs text-[var(--muted)]">
            Model: {forecast.method} (full history; filters apply to charts/KPIs)
          </p>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="AI insights">
          <InsightCards initialInsights={insights} />
        </Panel>
      </div>
    </div>
  );
}
