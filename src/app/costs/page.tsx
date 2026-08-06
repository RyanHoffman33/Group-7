import Link from "next/link";
import { Suspense } from "react";
import { formatCurrency, formatDate } from "@/features/billing/aging";
import { categoryLabel } from "@/features/costs/config";
import {
  getAverageCostPerProjectByCategory,
  getCategoryBreakdown,
  getCostDashboardStats,
  getCostDashboardYears,
  listContractsForCosts,
} from "@/features/costs/queries";
import { belongsInFlagsQueue } from "@/features/costs/flags";
import { CategoryBreakdown } from "@/components/costs/CategoryBreakdown";
import { CostFlagPills } from "@/components/costs/CostFlagsBanner";
import { YearFilter } from "@/components/costs/YearFilter";
import {
  Money,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

function parseYearParam(raw: string | undefined): number | undefined {
  if (!raw || raw === "all") return undefined;
  const y = Number(raw);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return undefined;
  return y;
}

export default async function CostsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const year = parseYearParam(sp.year);

  const [stats, breakdown, contracts, avgByCategory, years] = await Promise.all([
    getCostDashboardStats({ year }),
    getCategoryBreakdown({ year }),
    listContractsForCosts({ year }),
    getAverageCostPerProjectByCategory({ year }),
    getCostDashboardYears(),
  ]);

  const flagged = stats.entries.filter((e) => belongsInFlagsQueue(e)).slice(0, 8);
  const categoryTotalSum = avgByCategory.reduce((s, r) => s + r.total, 0);
  const categoryProjectSum = avgByCategory.reduce(
    (s, r) => s + r.projectCount,
    0,
  );
  const overallAvgPerProject =
    categoryProjectSum > 0 ? categoryTotalSum / categoryProjectSum : 0;

  return (
    <div>
      <PageHeader
        title="Cost & Resources"
        description="Costs are tracked by contract, customer, and event — commitments as soon as they're made, actual costs when incurred."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/costs/time"
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            >
              Log employee labor
            </Link>
            <Link
              href="/costs/expenses"
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)]"
            >
              Log expense
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Actual costs"
          value={formatCurrency(stats.totalActual)}
          hint="Incurred / actual status"
          tone="accent"
        />
        <Link href="/costs/commitments" className="block">
          <StatCard
            label="Committed"
            value={formatCurrency(stats.totalCommitted)}
            hint="Open commitments →"
          />
        </Link>
        <Link href="/costs/approvals" className="block">
          <StatCard
            label="Pending approvals"
            value={String(stats.pendingApprovals)}
            hint="Above approval threshold →"
            tone={stats.pendingApprovals > 0 ? "warn" : "default"}
          />
        </Link>
        <Link href="/costs/flags" className="block">
          <StatCard
            label="Open flags"
            value={String(stats.openFlags)}
            hint={
              stats.openFlags === 0
                ? "All clear →"
                : stats.openFlags === 1
                  ? "1 item needs attention →"
                  : `${stats.openFlags} items need attention →`
            }
            tone={stats.openFlags > 0 ? "danger" : "default"}
          />
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Suspense
          fallback={
            <div className="h-14 w-40 animate-pulse rounded-md bg-[#eef2f6]" />
          }
        >
          <YearFilter years={years} />
        </Suspense>
        {year != null ? (
          <p className="text-xs text-[var(--muted)]">
            Showing category totals, averages, and events for{" "}
            <span className="font-semibold text-[var(--ink)]">{year}</span>{" "}
            (by event date).
          </p>
        ) : null}
      </div>

      <div className="mb-4">
        <CategoryBreakdown
          rows={breakdown}
          title={
            year != null ? `Costs by category · ${year}` : "Costs by category"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title={
            year != null
              ? `Average cost per project · ${year}`
              : "Average cost per project"
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Avg per project</th>
                  <th className="pb-2 font-medium">Projects</th>
                  <th className="pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {avgByCategory.map((row) => (
                  <tr
                    key={row.category}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3 font-medium text-[var(--ink)]">
                      {categoryLabel(row.category)}
                    </td>
                    <td className="py-3">
                      <Money amount={row.average} />
                    </td>
                    <td className="py-3 text-[var(--muted)]">
                      {row.projectCount}
                    </td>
                    <td className="py-3 text-[var(--muted)]">
                      <Money amount={row.total} />
                    </td>
                  </tr>
                ))}
                {avgByCategory.length > 0 ? (
                  <tr className="border-t-2 border-[var(--line)] bg-[#f8fafb]">
                    <td className="py-3 font-semibold text-[var(--ink)]">
                      Total
                    </td>
                    <td className="py-3 font-semibold tabular-nums text-[var(--ink)]">
                      <Money amount={overallAvgPerProject} />
                    </td>
                    <td className="py-3 font-semibold tabular-nums text-[var(--ink)]">
                      {categoryProjectSum}
                    </td>
                    <td className="py-3 font-semibold tabular-nums text-[var(--ink)]">
                      <Money amount={categoryTotalSum} />
                    </td>
                  </tr>
                ) : null}
                {avgByCategory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-sm text-[var(--muted)]"
                    >
                      {year != null
                        ? `No project costs recorded for events in ${year}.`
                        : "No project costs recorded yet."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Average = total in that category ÷ number of projects that have at
            least one cost in the category
            {year != null
              ? `. Year filter uses each contract’s event date (${year}).`
              : "."}
          </p>
        </Panel>
        <Panel
          title={
            year != null
              ? `Events / contracts · ${year}`
              : "Events / contracts"
          }
        >
          {contracts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {year != null
                ? `No events with an event date in ${year}.`
                : "No contracts yet."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {contracts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {c.event_name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.customer_name}
                      {c.performance_complete ? " · Performance complete" : ""}
                    </p>
                  </div>
                  <Link
                    href={`/costs/events/${c.id}`}
                    className="text-sm font-semibold text-[var(--accent)]"
                  >
                    View costs
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Flagged entries"
          action={
            <Link
              href="/costs/flags"
              className="text-sm font-semibold text-[var(--accent)]"
            >
              All flags →
            </Link>
          }
        >
          {flagged.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No flagged costs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Event / customer</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="py-3">{formatDate(e.incurred_date)}</td>
                      <td className="py-3">
                        <Link
                          href={`/costs/entries/${e.id}`}
                          className="font-medium text-[var(--accent)]"
                        >
                          {e.event_name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          {e.customer_name}
                        </p>
                      </td>
                      <td className="py-3">
                        <StatusPill>{categoryLabel(e.category)}</StatusPill>
                      </td>
                      <td className="py-3">
                        <Money amount={e.amount} />
                      </td>
                      <td className="py-3">
                        <CostFlagPills entry={e} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
