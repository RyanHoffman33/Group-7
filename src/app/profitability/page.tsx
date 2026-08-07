import Link from "next/link";
import { formatCurrency } from "@/features/billing/aging";
import {
  getPortfolioTotals,
  listEventProfits,
  listExceptions,
  listMonthlyProfits,
} from "@/features/profitability/queries";
import { formatPct } from "@/features/profitability/labels";
import type { AnalyticsMonth } from "@/features/analytics/seed";
import { PageHeader, Panel, StatCard } from "@/components/billing/ui";
import { HistoryCharts } from "@/components/analytics/HistoryCharts";
import { MarginTable } from "@/components/profitability/MarginTable";

export const dynamic = "force-dynamic";

function toHistoryMonths(
  months: Awaited<ReturnType<typeof listMonthlyProfits>>,
): AnalyticsMonth[] {
  return months.map((m) => ({
    month: m.month.length === 7 ? `${m.month}-01` : m.month.slice(0, 10),
    revenue: m.recognized_revenue,
    cogs: m.direct_cogs,
    margin: m.net_margin,
    events: 0,
    arOutstanding: 0,
  }));
}

export default async function ProfitabilityPage() {
  const [events, exceptions, months] = await Promise.all([
    listEventProfits(),
    listExceptions(),
    listMonthlyProfits(),
  ]);
  const totals = await getPortfolioTotals(events, exceptions);
  const historyMonths = toHistoryMonths(months);
  const currentYear = new Date().getFullYear();
  const currentYearRecognizedRevenue = months
    .filter((m) => {
      const key = m.month.length >= 7 ? m.month.slice(0, 7) : m.month;
      return key.startsWith(String(currentYear));
    })
    .reduce((s, m) => s + m.recognized_revenue, 0);

  return (
    <div>
      <PageHeader
        title="Profitability"
        actions={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/analytics"
              className="text-[var(--accent)] hover:underline"
            >
              ← Analytics Center
            </Link>
            <Link
              href="/profitability/exceptions"
              className="text-[var(--accent)] hover:underline"
            >
              Exceptions →
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Recognized revenue"
          value={formatCurrency(currentYearRecognizedRevenue)}
          hint={`${currentYear} only · billed-recognized`}
          tone="accent"
        />
        <StatCard
          label="Blended margin"
          value={formatPct(totals.blendedMarginPct)}
          hint={`${formatCurrency(totals.grossMargin)} gross margin`}
        />
        <StatCard
          label="Events over budget"
          value={String(totals.eventsOverBudget)}
          hint="Actuals past total budget"
          tone={totals.eventsOverBudget > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Open exceptions"
          value={String(totals.openExceptions)}
          hint="Across all flag types"
          tone={totals.openExceptions > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mt-4">
        <Panel title="Recent history — revenues and costs">
          <HistoryCharts months={historyMonths} />
        </Panel>
      </div>

      <details className="group mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] open:shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight text-[var(--ink)]">
              Margin by event
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {events.length} event{events.length === 1 ? "" : "s"} · collapsed
              by default
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-[var(--accent)] group-open:hidden">
            Show table
          </span>
          <span className="hidden shrink-0 text-xs font-medium text-[var(--accent)] group-open:inline">
            Hide table
          </span>
        </summary>
        <div className="border-t border-[var(--line)] p-4">
          <div className="mb-3 flex justify-end">
            <Link
              href="/profitability/exceptions"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Exceptions inbox →
            </Link>
          </div>
          <MarginTable rows={events} />
        </div>
      </details>
    </div>
  );
}
