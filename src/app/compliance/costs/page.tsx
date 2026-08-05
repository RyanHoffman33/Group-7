import { formatDate, formatLabel } from "@/features/billing/aging";
import { listContractsForGaap } from "@/features/gaap/adapters/contracts";
import {
  listCostClassifications,
  listProfitabilityInputs,
} from "@/features/gaap/queries";
import { CostClassificationForm } from "@/components/gaap/Actions";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const [rows, profitability, contracts] = await Promise.all([
    listCostClassifications(),
    listProfitabilityInputs(),
    listContractsForGaap(),
  ]);

  return (
    <div>
      <PageHeader
        title="Cost classification"
        description="Direct event COGS match to recognized revenue. Reimbursable passthroughs are excluded from margin. Overhead / selling are period expenses. Stub rows until Walker’s expense module."
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="Classification board">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Period</th>
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">{formatDate(r.period)}</td>
                    <td className="py-3">{r.event_name}</td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          r.classification === "direct_event_cogs"
                            ? "accent"
                            : r.classification === "reimbursable_passthrough"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {formatLabel(r.classification)}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      <Money amount={r.amount} />
                    </td>
                    <td className="py-3 text-xs text-[var(--muted)]">
                      {r.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Classify cost">
          <CostClassificationForm
            contracts={contracts.map((c) => ({
              id: c.id,
              event_name: c.event_name,
            }))}
          />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Profitability inputs (v_profitability_inputs)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Recognized rev</th>
                  <th className="pb-2 font-medium">Direct COGS</th>
                  <th className="pb-2 font-medium">Passthrough</th>
                  <th className="pb-2 font-medium">Period exp.</th>
                  <th className="pb-2 font-medium">Implied margin</th>
                </tr>
              </thead>
              <tbody>
                {profitability.map((p) => {
                  const margin = p.recognized_revenue - p.direct_event_cogs;
                  return (
                    <tr
                      key={p.contract_id}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="py-3">{p.event_name}</td>
                      <td className="py-3">
                        <Money amount={p.recognized_revenue} />
                      </td>
                      <td className="py-3">
                        <Money amount={p.direct_event_cogs} />
                      </td>
                      <td className="py-3">
                        <Money amount={p.reimbursable_passthrough} />
                      </td>
                      <td className="py-3">
                        <Money amount={p.period_expenses} />
                      </td>
                      <td className="py-3 font-medium">
                        <Money amount={margin} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Joseph / Grayson should consume this view only — do not recompute
            recognized revenue in Profitability.
          </p>
        </Panel>
      </div>
    </div>
  );
}
