"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPercent } from "@/features/billing/aging";
import type { AnalyticsBundle } from "@/features/analytics/queries";
import { buildFallbackInsights } from "@/features/analytics/queries";
import {
  defaultAnalyticsFilter,
  filterAnalyticsHistory,
  yearsFromHistory,
  type AnalyticsPeriodFilter,
} from "@/features/analytics/filter";
import {
  overviewKpisFromData,
  rankingsFromSlices,
} from "@/features/analytics/rankings";
import { PageHeader, Panel, StatCard } from "@/components/billing/ui";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ChartLegend } from "@/components/analytics/ChartLegend";
import { HistoryCharts } from "@/components/analytics/HistoryCharts";
import { InsightCards } from "@/components/analytics/InsightCards";
import { TopNBarChart } from "@/components/analytics/TopNBarChart";

function filterLabel(f: AnalyticsPeriodFilter): string {
  const parts: string[] = [];
  if (f.year !== "all") parts.push(`Year ${f.year}`);
  if (f.quarter !== "all") parts.push(`Q${f.quarter}`);
  if (f.month !== "all") {
    const names = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    parts.push(names[Number(f.month) - 1] ?? `M${f.month}`);
  }
  return parts.length ? parts.join(" · ") : "all periods";
}

function formatSignedPct(pct: number | null): string {
  if (pct == null) return "—";
  const v = pct * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function formatPts(pts: number | null): string {
  if (pts == null) return "—";
  const sign = pts > 0 ? "+" : "";
  return `${sign}${pts.toFixed(1)} pts`;
}

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

  const chartHistory =
    filteredHistory.length > 0 ? filteredHistory : bundle.history;

  const rankings = useMemo(
    () => rankingsFromSlices(bundle.eventSlices, filter),
    [bundle.eventSlices, filter],
  );

  const overviewKpis = useMemo(
    () => overviewKpisFromData(bundle.history, rankings, filter),
    [bundle.history, rankings, filter],
  );

  const insights = useMemo(
    () =>
      buildFallbackInsights({
        history: chartHistory,
        forecast: bundle.forecast,
        source: bundle.source,
        kpis: bundle.kpis,
        rankings,
        filterLabel: filterLabel(filter),
      }),
    [chartHistory, bundle.forecast, bundle.source, bundle.kpis, rankings, filter],
  );

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
        <ChartLegend variant="history" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Year-over-year revenue growth"
          value={formatSignedPct(overviewKpis.yoyRevenueGrowthPct)}
          hint={overviewKpis.yoyRevenueHint}
          tone="accent"
        />
        <StatCard
          label="Year-over-year margin change"
          value={formatPts(overviewKpis.yoyMarginChangePts)}
          hint={overviewKpis.yoyMarginHint}
        />
        <StatCard
          label="Top customer share"
          value={
            overviewKpis.topCustomerSharePct == null
              ? "—"
              : formatPercent(overviewKpis.topCustomerSharePct)
          }
          hint={
            overviewKpis.topCustomerName
              ? `Of top-5 margin · ${overviewKpis.topCustomerName}`
              : "Of ranked customers in view"
          }
        />
        <StatCard
          label="Average margin"
          value={formatPercent(overviewKpis.avgMarginPct)}
          hint={
            overviewKpis.eventCountGrowthPct == null
              ? overviewKpis.avgMarginHint
              : `Events YoY ${formatSignedPct(overviewKpis.eventCountGrowthPct)}`
          }
        />
      </div>

      <div className="mt-4">
        <Panel title="Recent history — revenues vs costs">
          <HistoryCharts months={chartHistory} showLegend={false} />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Most profitable segments">
          <p className="mb-4 text-xs text-[var(--muted)]">
            Ranked by gross margin $ · top 5 · respects Year / Quarter / Month
            filters
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Vendors used
              </p>
              <p className="mb-3 text-[11px] text-[var(--muted)]">
                By allocated event gross margin $
              </p>
              <TopNBarChart items={rankings.vendors} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Event by group
              </p>
              <p className="mb-3 text-[11px] text-[var(--muted)]">
                By gross margin $ (event type)
              </p>
              <TopNBarChart items={rankings.eventGroups} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Customers
              </p>
              <p className="mb-3 text-[11px] text-[var(--muted)]">
                By gross margin $
              </p>
              <TopNBarChart items={rankings.customers} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Venues
              </p>
              <p className="mb-3 text-[11px] text-[var(--muted)]">
                By gross margin $
              </p>
              <TopNBarChart items={rankings.venues} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="AI summary — business plan ideas">
          <InsightCards
            initialInsights={insights}
            context={{
              filterLabel: filterLabel(filter),
              rankings,
              history: chartHistory,
              kpis: {
                yoyRevenueGrowthPct: overviewKpis.yoyRevenueGrowthPct,
                avgMarginPct: overviewKpis.avgMarginPct,
                topCustomerSharePct: overviewKpis.topCustomerSharePct,
                topCustomerName: overviewKpis.topCustomerName,
              },
            }}
          />
        </Panel>
      </div>
    </div>
  );
}
