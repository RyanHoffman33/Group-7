import { formatCurrency } from "@/features/billing/aging";
import { categoryLabel } from "@/features/costs/config";
import type { BudgetActualRow } from "@/features/costs/queries";
import { Money, Panel, StatusPill } from "@/components/billing/ui";

export function BudgetActualPanel({ rows }: { rows: BudgetActualRow[] }) {
  return (
    <Panel title="Budget vs actual">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr className="border-b border-[var(--line)]">
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 font-medium">Budgeted</th>
              <th className="pb-2 font-medium">Committed</th>
              <th className="pb-2 font-medium">Actual</th>
              <th className="pb-2 font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const over = r.variance < 0;
              return (
                <tr
                  key={r.category}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="py-3">{categoryLabel(r.category)}</td>
                  <td className="py-3">
                    <Money amount={r.budgeted} />
                  </td>
                  <td className="py-3">
                    <Money amount={r.committed} />
                  </td>
                  <td className="py-3">
                    <Money amount={r.actual} />
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2">
                      <Money amount={r.variance} />
                      {over ? (
                        <StatusPill tone="danger">Over</StatusPill>
                      ) : r.budgeted > 0 ? (
                        <StatusPill tone="ok">Under</StatusPill>
                      ) : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Variance = budgeted − (committed + actual). Negative means over budget.
        This is cost tracking — not revenue or cash paid.
      </p>
      {rows.some((r) => r.variance < 0) ? (
        <p className="mt-2 text-sm text-[var(--danger)]">
          Over-committed vs budget on{" "}
          {rows
            .filter((r) => r.variance < 0)
            .map((r) => categoryLabel(r.category))
            .join(", ")}{" "}
          (
          {formatCurrency(
            rows
              .filter((r) => r.variance < 0)
              .reduce((s, r) => s + r.variance, 0),
          )}
          ).
        </p>
      ) : null}
    </Panel>
  );
}
