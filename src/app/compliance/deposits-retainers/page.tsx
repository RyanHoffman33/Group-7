import { formatDate, formatLabel } from "@/features/billing/aging";
import { listDeposits, listBillingSchedules } from "@/features/billing/queries";
import { listContractPositions } from "@/features/gaap/queries";
import { Money, PageHeader, Panel, StatCard, StatusPill } from "@/components/billing/ui";
import { formatCurrency } from "@/features/billing/aging";

export const dynamic = "force-dynamic";

export default async function DepositsRetainersPage() {
  const [deposits, schedules, positions] = await Promise.all([
    listDeposits(),
    listBillingSchedules(),
    listContractPositions(),
  ]);

  const unearned = deposits.filter((d) => d.status === "unearned");
  const unearnedTotal = unearned.reduce((s, d) => s + Number(d.amount), 0);
  const deferredBilled = positions.reduce(
    (s, p) => s + p.deferred_billed_outstanding,
    0,
  );
  const retainers = schedules.filter(
    (s) => s.billing_method === "retainer" || s.billing_method === "recurring",
  );

  return (
    <div>
      <PageHeader
        title="Deposits & retainers"
        description="Customer deposits and unused retainer capacity are contract liabilities until performance earns them. Retainer fees recognize when the period invoice issues — not when cash alone arrives."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Unearned deposits"
          value={formatCurrency(unearnedTotal)}
          hint="Contract liability"
          tone="warn"
        />
        <StatCard
          label="Deferred billed outstanding"
          value={formatCurrency(deferredBilled)}
          hint="Billed before performance"
          tone="accent"
        />
        <StatCard
          label="Active retainer / recurring"
          value={String(retainers.filter((r) => r.active).length)}
          hint="Schedules that invoice each period"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Deposit liability register">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Received</th>
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">{formatDate(d.received_at)}</td>
                    <td className="py-3">
                      <div>{d.event_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {d.customer_name}
                      </div>
                    </td>
                    <td className="py-3">
                      <Money amount={Number(d.amount)} />
                    </td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          d.status === "unearned"
                            ? "warn"
                            : d.status === "applied"
                              ? "ok"
                              : "neutral"
                        }
                      >
                        {formatLabel(d.status)}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Applying a deposit to an earned invoice relieves the liability and
            reduces A/R — it does not create revenue by itself if recognition is
            still deferred.
          </p>
        </Panel>

        <Panel title="Retainer & recurring schedules">
          {retainers.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No retainer/recurring schedules yet. Create them under Billing →
              Recurring & drafts.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {retainers.map((s) => (
                <li
                  key={s.id}
                  className="border-b border-[var(--line)] pb-3 last:border-0"
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {s.event_name} · {formatLabel(s.billing_method)} ·{" "}
                    <Money amount={Number(s.amount)} /> / {s.cadence}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Next run {formatDate(s.next_run_date)} · Recognition on
                    period invoice issue (not cash float)
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
