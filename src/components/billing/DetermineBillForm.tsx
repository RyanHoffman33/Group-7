"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BILLING_METHODS } from "@/features/billing/determine";
import { issueDeterminedBill } from "@/features/billing/actions";
import type { BillingMethod } from "@/lib/supabase/types";

type ContractOption = {
  id: string;
  label: string;
  customer_id: string;
  billing_method: BillingMethod;
};

export function DetermineBillForm({
  contracts,
}: {
  contracts: ContractOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [contractId, setContractId] = useState(contracts[0]?.id ?? "");
  const selected = contracts.find((c) => c.id === contractId);
  const [method, setMethod] = useState<BillingMethod>(
    selected?.billing_method ?? "fixed_price",
  );
  const [serviceQty, setServiceQty] = useState(2);
  const [placementBase, setPlacementBase] = useState(50000);
  const [autoDraft, setAutoDraft] = useState(false);

  const methodMeta = BILLING_METHODS.find((m) => m.id === method);

  if (contracts.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
        No contracts available yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const result = await issueDeterminedBill({
              contract_id: String(fd.get("contract_id")),
              method: String(fd.get("method")),
              due_date: String(fd.get("due_date")),
              service_quantity: Number(fd.get("service_quantity") || 1),
              placement_base: Number(fd.get("placement_base") || 0),
              auto_apply_draft: Boolean(fd.get("auto_draft")),
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            if (result.id) router.push(`/billing/invoices/${result.id}`);
            else router.push("/billing/deposits");
            router.refresh();
          });
        }}
      >
        <h3 className="text-sm font-semibold">Determine & issue charge</h3>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Contract / event</span>
          <select
            name="contract_id"
            value={contractId}
            onChange={(e) => {
              setContractId(e.target.value);
              const c = contracts.find((x) => x.id === e.target.value);
              if (c) setMethod(c.billing_method);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Billing method</span>
          <select
            name="method"
            value={method}
            onChange={(e) => setMethod(e.target.value as BillingMethod)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            {BILLING_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {method === "per_service" ? (
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Service quantity</span>
            <input
              name="service_quantity"
              type="number"
              min={1}
              value={serviceQty}
              onChange={(e) => setServiceQty(Number(e.target.value))}
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
        ) : (
          <input type="hidden" name="service_quantity" value={1} />
        )}
        {method === "placement_fee" ? (
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Placement base ($)
            </span>
            <input
              name="placement_base"
              type="number"
              min={0}
              step="0.01"
              value={placementBase}
              onChange={(e) => setPlacementBase(Number(e.target.value))}
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
        ) : (
          <input type="hidden" name="placement_base" value={0} />
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Due date</span>
          <input
            name="due_date"
            type="date"
            required
            defaultValue={new Date(Date.now() + 30 * 86400000)
              .toISOString()
              .slice(0, 10)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="auto_draft"
            checked={autoDraft}
            onChange={(e) => setAutoDraft(e.target.checked)}
            value="1"
          />
          Simulate automatic customer ACH draft on issue
        </label>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Issuing…" : "Issue determined bill"}
        </button>
      </form>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold">How this method bills</h3>
        <p className="mt-2 text-sm font-medium text-[var(--ink)]">
          {methodMeta?.label}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {methodMeta?.summary}
        </p>
        <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
          Live totals for each contract appear below. Issuing posts the calculated
          amount to A/R (or records an unearned deposit when Deposit is selected).
        </p>
      </div>
    </div>
  );
}
