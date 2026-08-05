import { formatDate, formatLabel } from "@/features/billing/aging";
import { listContractsForGaap } from "@/features/gaap/adapters/contracts";
import { listContractModifications } from "@/features/gaap/queries";
import {
  ApplyModButton,
  ApproveModButton,
  ModDraftForm,
} from "@/components/gaap/Actions";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function ModificationsPage() {
  const [mods, contracts] = await Promise.all([
    listContractModifications(),
    listContractsForGaap(),
  ]);

  return (
    <div>
      <PageHeader
        title="Contract modifications"
        description="Change orders adjust remaining transaction price. Prospective for distinct added services; cumulative catch-up when remaining goods/services are not distinct. Historical invoices are never silently rewritten."
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="Change-order register">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Mod</th>
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Δ Price</th>
                  <th className="pb-2 font-medium">Treatment</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mods.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">
                      <div className="font-medium">{m.mod_number}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatDate(m.effective_date)}
                      </div>
                    </td>
                    <td className="py-3">
                      <div>{m.event_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {m.description}
                      </div>
                    </td>
                    <td className="py-3">
                      <Money amount={m.price_change} />
                    </td>
                    <td className="py-3">
                      {formatLabel(m.accounting_treatment)}
                    </td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          m.status === "applied"
                            ? "ok"
                            : m.status === "approved"
                              ? "accent"
                              : "neutral"
                        }
                      >
                        {formatLabel(m.status)}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {m.status === "draft" ? (
                          <ApproveModButton modId={m.id} />
                        ) : null}
                        {m.status === "approved" ? (
                          <ApplyModButton modId={m.id} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Stub until Gabriel owns real contracts — keyed by{" "}
            <code className="text-[11px]">contract_id</code>. Apply stores{" "}
            <code className="text-[11px]">prior_contract_value</code> and posts a
            ledger memo.
          </p>
        </Panel>

        <Panel title="New draft modification">
          <ModDraftForm
            contracts={contracts.map((c) => ({
              id: c.id,
              event_name: c.event_name,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
