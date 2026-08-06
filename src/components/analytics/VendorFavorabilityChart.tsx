import { Money } from "@/components/billing/ui";
import type { VendorFavorability } from "@/features/analytics/favorability";
import { SEGMENT_PALETTES } from "@/components/analytics/TopNBarChart";

const colors = SEGMENT_PALETTES.vendors;

export function VendorFavorabilityChart({
  items,
  emptyLabel = "No vendor favorability data for this filter.",
}: {
  items: VendorFavorability[];
  emptyLabel?: string;
}) {
  if (!items.length) {
    return (
      <p className="rounded-md bg-[var(--bg)] px-3 py-6 text-center text-sm text-[var(--muted)]">
        {emptyLabel}
      </p>
    );
  }

  const max = Math.max(1, ...items.map((i) => i.score));

  return (
    <ol className="space-y-3">
      {items.map((item, index) => {
        const pct = (item.score / max) * 100;
        return (
          <li key={item.label} className="group">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold tabular-nums"
                  style={{
                    background: colors.soft,
                    color: colors.ink,
                  }}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="min-w-0 truncate text-[13px] font-medium leading-tight text-[var(--ink)]">
                  {item.label}
                </span>
              </div>
              <span
                className="shrink-0 text-[13px] font-semibold tabular-nums"
                style={{ color: colors.ink }}
              >
                {item.score}
              </span>
            </div>
            <div className="flex items-center gap-2.5 pl-7">
              <div
                className="h-3 flex-1 overflow-hidden rounded-full"
                style={{ background: colors.track }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                    background: colors.bar,
                    boxShadow: "0 1px 2px rgba(11, 110, 110, 0.18)",
                  }}
                />
              </div>
              <span className="w-[4.5rem] shrink-0 text-right text-[11px] tabular-nums text-[var(--muted)]">
                {(item.cleanPct * 100).toFixed(0)}% clean
              </span>
            </div>
            <p className="mt-1 pl-7 text-[11px] text-[var(--muted)]">
              {item.events} event{item.events === 1 ? "" : "s"} · margin{" "}
              <Money amount={item.margin} />
            </p>
          </li>
        );
      })}
    </ol>
  );
}
