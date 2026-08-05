"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/features/billing/aging";
import type { AnalyticsMonth } from "@/features/analytics/seed";
import {
  defaultAnalyticsFilter,
  filterAnalyticsHistory,
  yearsFromHistory,
  type AnalyticsPeriodFilter,
} from "@/features/analytics/filter";
import { Money, PageHeader, Panel, StatCard } from "@/components/billing/ui";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ChartLegend } from "@/components/analytics/ChartLegend";
import { HistoryCharts } from "@/components/analytics/HistoryCharts";

export function AnalyticsHistoryClient({
  history,
  source,
}: {
  history: AnalyticsMonth[];
  source: string;
}) {
  const years = useMemo(() => yearsFromHistory(history), [history]);
  const [filter, setFilter] = useState<AnalyticsPeriodFilter>(() =>
    defaultAnalyticsFilter(history),
  );
  const filtered = useMemo(
    () => filterAnalyticsHistory(history, filter),
    [history, filter],
  );
  const rows = filtered.length ? filtered : history;
  const last = rows[rows.length - 1];
  const first = rows[0];

  return (
    <div>
      <PageHeader title="Analytics · History" />
      <p className="mb-3 text-xs text-[var(--muted)]">
        <Link href="/analytics" className="text-[var(--accent)] hover:underline">
          ← Analytics Center
        </Link>
        {" · "}
        Source: {source === "live" ? "live views" : "demo seed"}
      </p>

      <div className="mb-4">
        <AnalyticsFilters years={years} value={filter} onChange={setFilter} />
      </div>
      <div className="mb-3">
        <ChartLegend variant="history" />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Series length"
          value={`${rows.length} mo`}
          hint={
            first && last
              ? `${first.month.slice(0, 7)} → ${last.month.slice(0, 7)}`
              : undefined
          }
        />
        <StatCard
          label="Peak monthly revenue"
          value={formatCurrency(Math.max(...rows.map((m) => m.revenue), 0))}
        />
        <StatCard
          label="Latest month margin"
          value={last ? formatCurrency(last.margin) : "—"}
          hint={last ? last.month.slice(0, 7) : undefined}
        />
      </div>

      <Panel title="Trends">
        <HistoryCharts months={rows} showLegend={false} />
      </Panel>

      <div className="mt-4">
        <Panel title="Monthly table" bodyClassName="overflow-x-auto px-0 py-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Month</th>
                <th className="px-4 py-2 font-medium text-right">Revenue</th>
                <th className="px-4 py-2 font-medium text-right">COGS</th>
                <th className="px-4 py-2 font-medium text-right">Margin</th>
                <th className="px-4 py-2 font-medium text-right">Events</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((m) => (
                <tr
                  key={m.month}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="px-4 py-2 font-medium">{m.month.slice(0, 7)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[#2f9a57]">
                    <Money amount={m.revenue} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-[#e11d48]">
                    <Money amount={m.cogs} />
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      m.margin >= 0 ? "text-[#2f9a57]" : "text-[#e11d48]"
                    }`}
                  >
                    <Money amount={m.margin} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
