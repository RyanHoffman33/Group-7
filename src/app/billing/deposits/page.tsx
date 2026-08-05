import { listCustomers, listContracts } from "@/features/billing/adapters/upstream";
import { listDeposits } from "@/features/billing/queries";
import { formatDate, formatLabel } from "@/features/billing/aging";
import { DepositForm } from "@/components/billing/Actions";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function DepositsPage() {
  const [deposits, customers, contracts] = await Promise.all([
    listDeposits(),
    listCustomers(),
    listContracts(),
  ]);

  const unearned = deposits.filter((d) => d.status === "unearned");
  const unearnedTotal = unearned.reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div>
      <PageHeader
        title="Customer deposits"
        description="Deposits are liabilities (unearned revenue) until performance is earned or the deposit is applied to an invoice."
      />

      <div className="mb-4 rounded-lg border border-[var(--warn)]/30 bg-[#fff7eb] px-4 py-3 text-sm">
        Unearned deposit liability outstanding:{" "}
        <strong>
          <Money amount={unearnedTotal} />
        </strong>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Deposit ledger">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Received</th>
                  <th className="pb-2 font-medium">Customer / Event</th>
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
                      <div>{d.customer_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {d.event_name}
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
        </Panel>

        <Panel title="Record deposit (unearned)">
          <DepositForm
            customers={customers.map((c) => ({ id: c.id, label: c.name }))}
            contracts={contracts.map((c) => ({
              id: c.id,
              label: c.event_name,
              customer_id: c.customer_id,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
