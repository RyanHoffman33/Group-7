import Link from "next/link";
import { formatCurrency } from "@/features/billing/aging";
import {
  getPortfolioTotals,
  listEventProfits,
  listExceptions,
  listMonthlyProfits,
} from "@/features/profitability/queries";
import { formatPct } from "@/features/profitability/labels";
import { PageHeader, Panel, StatCard } from "@/components/billing/ui";
import { MarginTable } from "@/components/profitability/MarginTable";
import { TrendBars } from "@/components/profitability/TrendBars";

export const dynamic = "force-dynamic";

export default async function ProfitabilityPage() {
  const [events, exceptions, months] = await Promise.all([
    listEventProfits(),
    listExceptions(),
    listMonthlyProfits(),
  ]);
  const totals = await getPortfolioTotals(events, exceptions);

  return (
    <div>
      <PageHeader
        title="Profitability"
        description="Event margins on the billed-recognized basis — the same revenue the GAAP compliance pages report. Pass-throughs excluded from margin; overhead as period expense. Read from the v_profit_* views."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Recognized revenue"
          value={formatCurrency(totals.recognizedRevenue)}
          hint="All events, billed-recognized"
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

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel
          title="Margin by event"
          action={
            <Link
              href="/profitability/exceptions"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Exceptions inbox →
            </Link>
          }
        >
          <MarginTable rows={events} />
        </Panel>

        <Panel title="Monthly P&L trend">
          <TrendBars months={months} />
          <p className="mt-4 text-xs text-[var(--muted)]">
            Revenue dated by recognition evidence (event date), costs by
            incurred date. Source:{" "}
            <code className="text-[11px]">v_profit_monthly</code>.
          </p>
        </Panel>
      </div>
    </div>
  );
}
