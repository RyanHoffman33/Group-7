import { Money } from "@/components/billing/ui";
import { ANALYTICS_COLORS } from "@/components/analytics/ChartLegend";
import type { RankedEntity } from "@/features/analytics/rankings";

export function TopNBarChart({
  items,
  emptyLabel = "No data for this filter.",
}: {
  items: RankedEntity[];
  emptyLabel?: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...items.map((i) => Math.abs(i.margin)));

  return (
    <ol className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate font-medium text-[var(--ink)]">
              {item.label}
            </span>
            <span
              className={`shrink-0 tabular-nums ${
                item.margin >= 0 ? "text-[#2f9a57]" : "text-[#e11d48]"
              }`}
            >
              <Money amount={item.margin} />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 flex-1 rounded-full bg-[#eef2f6]">
              <div
                className="h-2.5 rounded-full"
                style={{
                  width: `${(Math.abs(item.margin) / max) * 100}%`,
                  background:
                    item.margin >= 0
                      ? ANALYTICS_COLORS.marginPos
                      : ANALYTICS_COLORS.marginNeg,
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-[10px] text-[var(--muted)]">
              {item.count}×
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
