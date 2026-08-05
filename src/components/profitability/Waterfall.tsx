import { Money, StatusPill } from "@/components/billing/ui";
import type {
  EventProfit,
  OverheadAllocation,
  ProfitException,
} from "@/features/profitability/queries";
import { exceptionMeta, exceptionTitle } from "@/features/profitability/labels";

/**
 * The pitch-narration centerpiece: the event's money story as a waterfall.
 * Contract value → recognized revenue → earned-not-billed → direct costs →
 * gross margin. Every figure is a v_profit_event / v_profit_overhead_allocation
 * column rendered as-is.
 */

type Step = {
  label: string;
  amount: number;
  hint?: string;
  kind: "base" | "revenue" | "context" | "cost" | "margin";
};

const kindStyles: Record<Step["kind"], { bar: string; text: string }> = {
  base: { bar: "bg-[var(--ink)]/80", text: "text-[var(--ink)]" },
  revenue: { bar: "bg-[var(--accent)]", text: "text-[var(--accent)]" },
  context: { bar: "bg-[#c8d4e0]", text: "text-[var(--muted)]" },
  cost: { bar: "bg-[var(--warn)]/75", text: "text-[var(--warn)]" },
  margin: { bar: "bg-[var(--ok)]", text: "text-[var(--ok)]" },
};

export function Waterfall({
  event,
  overhead,
  exceptions,
}: {
  event: EventProfit;
  overhead: OverheadAllocation | null;
  exceptions: ProfitException[];
}) {
  const steps: Step[] = [
    {
      label: "Contract value",
      amount: event.contract_value,
      hint: "Current value incl. change orders",
      kind: "base",
    },
    {
      label: "Recognized revenue",
      amount: event.recognized_revenue,
      hint: "Billed-recognized basis — matches GAAP compliance",
      kind: "revenue",
    },
    {
      label: "Earned, not billed",
      amount: event.earned_not_billed,
      hint: "Contract asset — outside margin until billed",
      kind: "context",
    },
    {
      label: "Direct costs",
      amount: -event.direct_cogs,
      hint: "Deduped COGS across cost sources",
      kind: "cost",
    },
    {
      label: "Gross margin",
      amount: event.gross_margin,
      hint:
        event.gross_margin_pct == null
          ? "No recognized revenue yet"
          : `${event.gross_margin_pct.toFixed(1)}% of recognized revenue`,
      kind: "margin",
    },
  ];

  const scale = Math.max(1, ...steps.map((s) => Math.abs(s.amount)));

  return (
    <div>
      <ol className="space-y-3">
        {steps.map((s) => {
          const width = (Math.abs(s.amount) / scale) * 100;
          const negative = s.amount < 0;
          const styles = kindStyles[s.kind];
          return (
            <li key={s.label}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-[var(--ink)]">
                  {s.label}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${styles.text}`}
                >
                  {negative ? "−" : ""}
                  <Money amount={Math.abs(s.amount)} />
                </span>
              </div>
              <div className="mt-1 h-3 w-full rounded-full bg-[#eef2f6]">
                <div
                  className={`h-3 rounded-full ${styles.bar}`}
                  style={{ width: `${Math.max(width, s.amount === 0 ? 0 : 2)}%` }}
                />
              </div>
              {s.hint ? (
                <p className="mt-0.5 text-xs text-[var(--muted)]">{s.hint}</p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <dl className="mt-5 grid gap-3 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Pass-through (memo)
          </dt>
          <dd className="mt-1 font-semibold">
            <Money amount={event.reimbursable_passthrough} />
          </dd>
          <dd className="text-xs text-[var(--muted)]">
            Agent/net — excluded from margin
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Allocated overhead
          </dt>
          <dd className="mt-1 font-semibold">
            {overhead ? <Money amount={overhead.allocated_overhead} /> : "—"}
          </dd>
          <dd className="text-xs text-[var(--muted)]">
            Pro-rata share of period overhead pool
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Fully-loaded margin
          </dt>
          <dd
            className={`mt-1 font-semibold ${
              overhead && overhead.fully_loaded_margin < 0
                ? "text-[var(--danger)]"
                : ""
            }`}
          >
            {overhead ? <Money amount={overhead.fully_loaded_margin} /> : "—"}
          </dd>
          <dd className="text-xs text-[var(--muted)]">
            Gross margin less allocated overhead
          </dd>
        </div>
      </dl>

      {exceptions.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
          {exceptions.map((f, i) => (
            <StatusPill
              key={`${f.exception_type}-${f.ref_id ?? i}`}
              tone={exceptionMeta[f.exception_type]?.tone ?? "warn"}
            >
              {exceptionTitle(f.exception_type)}
            </StatusPill>
          ))}
        </div>
      ) : null}
    </div>
  );
}
