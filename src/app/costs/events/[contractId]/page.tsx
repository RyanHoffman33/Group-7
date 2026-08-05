import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatCurrency, formatDate, formatLabel } from "@/features/billing/aging";
import { categoryLabel } from "@/features/costs/config";
import {
  getBudgetVsActual,
  getCategoryBreakdown,
  getContractForCosts,
  listCostEntries,
} from "@/features/costs/queries";
import { activeFlags, hasAnyFlag } from "@/features/costs/flags";
import { BudgetActualPanel } from "@/components/costs/BudgetActualPanel";
import { CategoryBreakdown } from "@/components/costs/CategoryBreakdown";
import { CostFilters } from "@/components/costs/CostFilters";
import {
  CostFlagPills,
  CostFlagsBanner,
} from "@/components/costs/CostFlagsBanner";
import {
  Money,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function EventCostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ category?: string; status?: string; flagged?: string }>;
}) {
  const { contractId } = await params;
  const sp = await searchParams;
  const contract = await getContractForCosts(contractId);
  if (!contract) notFound();

  const [entries, budgetRows, breakdown] = await Promise.all([
    listCostEntries({
      contractId,
      category: sp.category || undefined,
      commitmentStatus: sp.status || undefined,
      flaggedOnly: sp.flagged === "1",
    }),
    getBudgetVsActual(contractId),
    getCategoryBreakdown({ contractId }),
  ]);

  const budgeted = budgetRows.reduce((s, r) => s + r.budgeted, 0);
  const committed = budgetRows.reduce((s, r) => s + r.committed, 0);
  const actual = budgetRows.reduce((s, r) => s + r.actual, 0);
  const variance = budgeted - (committed + actual);

  const bannerFlags = Array.from(
    new Set(entries.flatMap((e) => activeFlags(e))),
  );

  return (
    <div>
      <PageHeader
        title={contract.event_name}
        description={`Customer: ${contract.customer_name}. Budgeted, committed, and actual costs for this contract/event.`}
        actions={
          <Link
            href="/costs"
            className="text-sm font-semibold text-[var(--accent)]"
          >
            ← All costs
          </Link>
        }
      />

      <CostFlagsBanner
        flags={bannerFlags}
        title="Event cost control alerts"
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Budgeted" value={formatCurrency(budgeted)} />
        <StatCard label="Committed" value={formatCurrency(committed)} />
        <StatCard
          label="Actual"
          value={formatCurrency(actual)}
          tone="accent"
        />
        <StatCard
          label="Variance"
          value={formatCurrency(variance)}
          hint="Budget − (committed + actual)"
          tone={variance < 0 ? "danger" : "default"}
        />
      </div>

      <div className="mb-4">
        <BudgetActualPanel rows={budgetRows} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel
          title="Cost register"
          action={
            <Suspense fallback={null}>
              <CostFilters />
            </Suspense>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Entered by</th>
                  <th className="pb-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
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
                        {categoryLabel(e.category)}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Money amount={e.amount} />
                    </td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          e.commitment_status === "actual" ? "accent" : "neutral"
                        }
                      >
                        {formatLabel(e.commitment_status)}
                      </StatusPill>
                    </td>
                    <td className="py-3 text-[var(--muted)]">{e.entered_by}</td>
                    <td className="py-3">
                      {hasAnyFlag(e) ? (
                        <CostFlagPills entry={e} />
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-sm text-[var(--muted)]"
                    >
                      No costs match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
        <CategoryBreakdown rows={breakdown} title="Category mix" />
      </div>
    </div>
  );
}
