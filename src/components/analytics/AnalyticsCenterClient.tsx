"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import { InsightCards } from "@/components/analytics/InsightCards";
import {
  SEGMENT_PALETTES,
  TopNBarChart,
  type SegmentPaletteKey,
} from "@/components/analytics/TopNBarChart";
import { VendorFavorabilityChart } from "@/components/analytics/VendorFavorabilityChart";
import { vendorFavorabilityFromData } from "@/features/analytics/favorability";

function SegmentCard({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: SegmentPaletteKey;
  children: ReactNode;
}) {
  const colors = SEGMENT_PALETTES[accent];
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--bg)]/60 p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span
          className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
          style={{ background: colors.mark }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-[var(--ink)]">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

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

  const vendorFavorability = useMemo(
    () =>
      vendorFavorabilityFromData(
        bundle.eventSlices,
        bundle.vendorHealth,
        filter,
      ),
    [bundle.eventSlices, bundle.vendorHealth, filter],
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="YoY revenue (same period)"
          value={formatSignedPct(overviewKpis.yoyRevenueGrowthPct)}
          hint={overviewKpis.yoyRevenueHint}
          tone="accent"
        />
        <StatCard
          label="YoY margin (same period)"
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
              : `Events YoY ${formatSignedPct(overviewKpis.eventCountGrowthPct)} · same period`
          }
        />
      </div>

      <div className="mt-4">
        <Panel title="Most profitable segments">
          <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">
            Ranked by gross margin $ · top 5 · respects Year / Quarter / Month
            filters
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SegmentCard
              title="Vendors used"
              subtitle="By allocated event gross margin $"
              accent="vendors"
            >
              <TopNBarChart items={rankings.vendors} palette="vendors" />
            </SegmentCard>
            <SegmentCard
              title="Event by group"
              subtitle="By gross margin $ (event type)"
              accent="eventGroups"
            >
              <TopNBarChart items={rankings.eventGroups} palette="eventGroups" />
            </SegmentCard>
            <SegmentCard
              title="Customers"
              subtitle="By gross margin $"
              accent="customers"
            >
              <TopNBarChart items={rankings.customers} palette="customers" />
            </SegmentCard>
            <SegmentCard
              title="Venues"
              subtitle="By gross margin $"
              accent="venues"
            >
              <TopNBarChart items={rankings.venues} palette="venues" />
            </SegmentCard>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Vendor favorability">
          <p className="mb-5 text-center text-xs leading-relaxed text-[var(--muted)]">
            Favorability (demo) · top 5 · 0–100 blend of margin, cost-entry
            cleanliness, and event volume maps to a 1–5 star rating (score ÷ 20,
            half-stars) · respects Year / Quarter / Month filters
          </p>
          <div className="mx-auto w-full max-w-2xl">
            <VendorFavorabilityChart items={vendorFavorability} />
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
