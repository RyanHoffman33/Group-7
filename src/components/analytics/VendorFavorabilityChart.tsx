import { Money } from "@/components/billing/ui";
import type { VendorFavorability } from "@/features/analytics/favorability";

/** Amber/gold that sits with MainEvent teal — no purple glow. */
const STAR = {
  fill: "#c9922a",
  empty: "#e8dcc4",
  soft: "#faf6ee",
  chip: "#f3ebe0",
  chipInk: "#7a5a1e",
} as const;

/** Map 0–100 favorability → 0–5 stars in half-star steps (score ÷ 20). */
export function scoreToStars(score: number): number {
  const raw = Math.min(100, Math.max(0, score)) / 20;
  return Math.round(raw * 2) / 2;
}

function ratingLabel(stars: number): string {
  if (stars >= 4.5) return "Preferred";
  if (stars >= 3.5) return "Strong";
  if (stars >= 2.5) return "Solid";
  if (stars >= 1.5) return "Fair";
  return "Watch";
}

const STAR_PATH =
  "M12 2.6l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.5 6.6 19.4l1-6.1L3.2 9l6.1-.9L12 2.6z";

function StarIcon({ state }: { state: "full" | "half" | "empty" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5"
      aria-hidden
    >
      {state === "half" ? (
        <>
          <path fill={STAR.empty} d={STAR_PATH} />
          <svg width="12" height="24" viewBox="0 0 12 24" overflow="hidden">
            <path fill={STAR.fill} d={STAR_PATH} />
          </svg>
        </>
      ) : (
        <path
          fill={state === "full" ? STAR.fill : STAR.empty}
          d={STAR_PATH}
        />
      )}
    </svg>
  );
}

function StarRow({ stars }: { stars: number }) {
  const slots: Array<"full" | "half" | "empty"> = [];
  for (let i = 1; i <= 5; i++) {
    if (stars >= i) slots.push("full");
    else if (stars >= i - 0.5) slots.push("half");
    else slots.push("empty");
  }
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${stars} out of 5 stars`}
    >
      {slots.map((state, i) => (
        <StarIcon key={i} state={state} />
      ))}
    </div>
  );
}

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

  return (
    <ol className="mx-auto grid w-full max-w-xl gap-3">
      {items.map((item, index) => {
        const stars = scoreToStars(item.score);
        const chip = ratingLabel(stars);
        return (
          <li
            key={item.label}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-center shadow-[0_1px_2px_rgba(15,28,46,0.04)]"
            style={{ background: `linear-gradient(135deg, var(--surface) 60%, ${STAR.soft} 100%)` }}
          >
            <div className="flex flex-col items-center gap-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
                style={{
                  background: STAR.chip,
                  color: STAR.chipInk,
                }}
                aria-hidden
              >
                {index + 1}
              </span>
              <p className="max-w-full truncate px-2 text-[13px] font-semibold leading-tight text-[var(--ink)] sm:text-sm">
                {item.label}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                <StarRow stars={stars} />
                <span
                  className="text-[12px] font-semibold tabular-nums"
                  style={{ color: STAR.chipInk }}
                >
                  {stars.toFixed(1)} / 5
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: STAR.chip,
                  color: STAR.chipInk,
                }}
              >
                {chip}
              </span>
              <p className="text-[11px] leading-snug text-[var(--muted)]">
                {item.events} event{item.events === 1 ? "" : "s"} · margin{" "}
                <Money amount={item.margin} /> ·{" "}
                {(item.cleanPct * 100).toFixed(0)}% clean
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
