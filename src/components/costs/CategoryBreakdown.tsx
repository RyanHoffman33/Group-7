import { formatCurrency } from "@/features/billing/aging";
import { categoryLabel } from "@/features/costs/config";
import type { CategoryBreakdownRow } from "@/features/costs/queries";
import { Panel } from "@/components/billing/ui";

export function CategoryBreakdown({
  rows,
  title = "Costs by category",
}: {
  rows: CategoryBreakdownRow[];
  title?: string;
}) {
  const scaleMax = 100_000;

  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No costs recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--ink)]">
                  {categoryLabel(r.category)}
                </span>
                <span className="tabular-nums text-[var(--muted)]">
                  {formatCurrency(r.amount)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#eef2f6]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{
                    width: `${Math.min(100, (r.amount / scaleMax) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
