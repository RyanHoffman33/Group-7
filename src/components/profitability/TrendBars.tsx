import { Money } from "@/components/billing/ui";
import type { MonthlyProfit } from "@/features/profitability/queries";
import { formatMonth } from "@/features/profitability/labels";

/**
 * Monthly P&L trend as paired revenue/COGS bars with the net margin beneath.
 * Pure presentation of v_profit_monthly rows; bar widths are relative to the
 * largest monthly revenue figure.
 */
export function TrendBars({ months }: { months: MonthlyProfit[] }) {
  const max = Math.max(
    1,
    ...months.map((m) => Math.max(m.recognized_revenue, m.direct_cogs)),
  );

  return (
    <ol className="space-y-4">
      {months.map((m) => (
        <li key={m.month}>
          <div className="flex items-baseline justify-between gap-4 text-xs">
            <span className="font-medium text-[var(--ink)]">
              {formatMonth(m.month)}
            </span>
            <span
              className={
                m.net_margin < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]"
              }
            >
              Net <Money amount={m.net_margin} />
            </span>
          </div>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-2.5 flex-1 rounded-full bg-[#eef2f6]">
                <div
                  className="h-2.5 rounded-full bg-[var(--accent)]"
                  style={{
                    width: `${(m.recognized_revenue / max) * 100}%`,
                  }}
                />
              </div>
              <span className="w-24 text-right text-xs tabular-nums text-[var(--muted)]">
                <Money amount={m.recognized_revenue} />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 flex-1 rounded-full bg-[#eef2f6]">
                <div
                  className="h-2.5 rounded-full bg-[var(--warn)]/70"
                  style={{ width: `${(m.direct_cogs / max) * 100}%` }}
                />
              </div>
              <span className="w-24 text-right text-xs tabular-nums text-[var(--muted)]">
                <Money amount={m.direct_cogs} />
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
