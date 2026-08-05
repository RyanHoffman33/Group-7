import type { AnalyticsMonth } from "@/features/analytics/seed";
import { Money } from "@/components/billing/ui";
import { ANALYTICS_COLORS, ChartLegend } from "@/components/analytics/ChartLegend";

function formatMonth(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function HistoryCharts({
  months,
  showLegend = true,
}: {
  months: AnalyticsMonth[];
  showLegend?: boolean;
}) {
  const series = [...months].slice(-12);
  const maxRev = Math.max(1, ...series.map((m) => Math.max(m.revenue, m.cogs)));
  const maxAbsMargin = Math.max(1, ...series.map((m) => Math.abs(m.margin)));

  if (series.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No months match the selected Year / Quarter / Month filters.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {showLegend ? <ChartLegend variant="history" /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Revenue vs costs
          </p>
          <ol className="space-y-3">
            {series.map((m) => (
              <li key={m.month}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{formatMonth(m.month)}</span>
                  <span
                    className={
                      m.margin >= 0
                        ? "text-[#2f9a57]"
                        : "text-[#e11d48]"
                    }
                  >
                    Margin <Money amount={m.margin} />
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[10px] uppercase text-[var(--muted)]">
                      Rev
                    </span>
                    <div className="h-2.5 flex-1 rounded-full bg-[#eef2f6]">
                      <div
                        className="h-2.5 rounded-full"
                        style={{
                          width: `${(m.revenue / maxRev) * 100}%`,
                          background: ANALYTICS_COLORS.revenue,
                        }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-[#2f9a57]">
                      <Money amount={m.revenue} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[10px] uppercase text-[var(--muted)]">
                      Cost
                    </span>
                    <div className="h-2.5 flex-1 rounded-full bg-[#eef2f6]">
                      <div
                        className="h-2.5 rounded-full"
                        style={{
                          width: `${(m.cogs / maxRev) * 100}%`,
                          background: ANALYTICS_COLORS.cost,
                        }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-[#e11d48]">
                      <Money amount={m.cogs} />
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Margin by month
          </p>
          <ol className="space-y-3">
            {series.map((m) => (
              <li key={`m-${m.month}`}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{formatMonth(m.month)}</span>
                  <span className="text-[var(--muted)]">{m.events} events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 rounded-full bg-[#eef2f6]">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${(Math.abs(m.margin) / maxAbsMargin) * 100}%`,
                        background:
                          m.margin >= 0
                            ? ANALYTICS_COLORS.marginPos
                            : ANALYTICS_COLORS.marginNeg,
                      }}
                    />
                  </div>
                  <span
                    className={`w-24 text-right text-xs tabular-nums ${
                      m.margin >= 0 ? "text-[#2f9a57]" : "text-[#e11d48]"
                    }`}
                  >
                    <Money amount={m.margin} />
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
