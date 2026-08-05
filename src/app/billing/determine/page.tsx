import { BILLING_METHODS, determineBill } from "@/features/billing/determine";
import { listContracts, listCustomers } from "@/features/billing/adapters/upstream";
import {
  contractBilledToDate,
  listUnbilledInputs,
} from "@/features/billing/queries";
import { DetermineBillForm } from "@/components/billing/DetermineBillForm";
import { Money, PageHeader, Panel } from "@/components/billing/ui";
import type {
  BillableCost,
  BillableTimeEntry,
  BillingMethod,
  Contract,
  ContractMilestone,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DetermineBillingPage() {
  const [contracts, customers] = await Promise.all([
    listContracts(),
    listCustomers(),
  ]);
  const custName = new Map(customers.map((c) => [c.id, c.name]));

  const cards = await Promise.all(
    contracts.map(async (c) => {
      const contract = c as Contract;
      const [alreadyBilled, inputs] = await Promise.all([
        contractBilledToDate(c.id),
        listUnbilledInputs(c.id),
      ]);
      const method = (contract.billing_method ||
        "fixed_price") as BillingMethod;
      const det = determineBill({
        contract,
        method,
        alreadyBilled,
        unbilledTime: inputs.time as BillableTimeEntry[],
        unbilledCosts: inputs.costs as BillableCost[],
        openMilestones: inputs.milestones as ContractMilestone[],
        serviceQuantity: 2,
        placementBase: Number(contract.contract_value),
      });
      return {
        contract,
        customerName: custName.get(c.customer_id) ?? "Customer",
        alreadyBilled,
        det,
        inputs,
      };
    }),
  );

  return (
    <div>
      <PageHeader
        title="Determine what to bill"
        description="Shows how each billing method calculates the customer charge — fixed price, hourly, T&M, milestones, progress, retainers, deposits, recurring, per-service, placement, reimbursables, and cost-plus."
      />

      <Panel title="Billing method catalog">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {BILLING_METHODS.map((m) => (
            <div
              key={m.id}
              className="rounded-md border border-[var(--line)] p-3"
            >
              <p className="font-semibold text-sm">{m.label}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{m.summary}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-4">
        <DetermineBillForm
          contracts={contracts.map((c) => ({
            id: c.id,
            label: `${custName.get(c.customer_id)} — ${(c as Contract).event_name}`,
            customer_id: c.customer_id,
            billing_method: ((c as Contract).billing_method ||
              "fixed_price") as BillingMethod,
          }))}
        />
      </div>

      <div className="mt-6 space-y-4">
        <h3 className="font-[family-name:var(--font-display)] text-xl">
          Contract bill determinations (default method)
        </h3>
        {cards.map(({ contract, customerName, alreadyBilled, det, inputs }) => (
          <Panel
            key={contract.id}
            title={`${customerName} · ${contract.event_name}`}
            action={
              <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
                {det.methodLabel}
              </span>
            }
          >
            <div className="grid gap-4 lg:grid-cols-3 text-sm">
              <div>
                <p className="text-[var(--muted)]">Contract value</p>
                <p className="font-semibold">
                  <Money amount={Number(contract.contract_value)} />
                </p>
                <p className="mt-2 text-[var(--muted)]">Already billed</p>
                <p className="font-semibold">
                  <Money amount={alreadyBilled} />
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Unbilled time: {inputs.time.length} · costs:{" "}
                  {inputs.costs.length} · milestones: {inputs.milestones.length}
                </p>
              </div>
              <div className="lg:col-span-2">
                <ul className="list-disc space-y-1 pl-5 text-[var(--muted)]">
                  {det.explanation.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <ul className="mt-3 space-y-1 border-t border-[var(--line)] pt-3">
                  {det.lines.map((l) => (
                    <li key={l.description} className="flex justify-between gap-3">
                      <span>{l.description}</span>
                      <Money amount={l.amount} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-semibold">
                  Determined total: <Money amount={det.total} />
                  {det.depositMode ? " (deposit / unearned)" : ""}
                </p>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
