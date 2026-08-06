import { Money } from "@/components/billing/ui";
import type { RankedEntity } from "@/features/analytics/rankings";

/** Palette keyed to MainEvent tokens — teal family + ok/danger, no purple. */
export const SEGMENT_PALETTES = {
  vendors: {
    mark: "#0b6e6e",
    bar: "linear-gradient(90deg, #0b6e6e 0%, #149494 100%)",
    soft: "var(--accent-soft)",
    ink: "var(--accent)",
    track: "#e0eded",
  },
  eventGroups: {
    mark: "#1f6b3a",
    bar: "linear-gradient(90deg, #1f6b3a 0%, #2f9a57 100%)",
    soft: "#e8f3ec",
    ink: "var(--ok)",
    track: "#e4efe8",
  },
  customers: {
    mark: "#0f1c2e",
    bar: "linear-gradient(90deg, #0f1c2e 0%, #3d5268 100%)",
    soft: "#eef1f4",
    ink: "var(--ink)",
    track: "#e8ecf0",
  },
  venues: {
    mark: "#0a5a5a",
    bar: "linear-gradient(90deg, #0a5a5a 0%, #0b6e6e 55%, #2a8a6a 100%)",
    soft: "#e8f2f0",
    ink: "#0a5a5a",
    track: "#e2ecea",
  },
} as const;

export type SegmentPaletteKey = keyof typeof SEGMENT_PALETTES;

const NEG_BAR = "linear-gradient(90deg, #9b1c1c 0%, #c43a3a 100%)";

export function TopNBarChart({
  items,
  emptyLabel = "No data for this filter.",
  palette = "vendors",
}: {
  items: RankedEntity[];
  emptyLabel?: string;
  palette?: SegmentPaletteKey;
}) {
  if (!items.length) {
    return (
      <p className="rounded-md bg-[var(--bg)] px-3 py-6 text-center text-sm text-[var(--muted)]">
        {emptyLabel}
      </p>
    );
  }

  const colors = SEGMENT_PALETTES[palette];
  const max = Math.max(1, ...items.map((i) => Math.abs(i.margin)));

  return (
    <ol className="space-y-3">
      {items.map((item, index) => {
        const pct = (Math.abs(item.margin) / max) * 100;
        const positive = item.margin >= 0;
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
                className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                  positive ? "text-[var(--ok)]" : "text-[var(--danger)]"
                }`}
              >
                <Money amount={item.margin} />
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
                    background: positive ? colors.bar : NEG_BAR,
                    boxShadow: positive
                      ? "0 1px 2px rgba(11, 110, 110, 0.18)"
                      : "0 1px 2px rgba(155, 28, 28, 0.18)",
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-[var(--muted)]">
                {item.count}×
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
