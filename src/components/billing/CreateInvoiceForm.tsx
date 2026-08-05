"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAndIssueInvoice } from "@/features/billing/actions";

type Option = { id: string; label: string; customer_id?: string };

export function CreateInvoiceForm({
  customers,
  contracts,
  defaultCustomerId,
  defaultContractId,
}: {
  customers: Option[];
  contracts: Option[];
  defaultCustomerId?: string;
  defaultContractId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initialCustomer =
    defaultCustomerId ||
    contracts.find((c) => c.id === defaultContractId)?.customer_id ||
    customers[0]?.id ||
    "";
  const [customerId, setCustomerId] = useState(initialCustomer);
  const filtered = contracts.filter(
    (c) => !customerId || c.customer_id === customerId,
  );
  const defaultContract =
    defaultContractId && filtered.some((c) => c.id === defaultContractId)
      ? defaultContractId
      : filtered[0]?.id ?? "";

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const result = await createAndIssueInvoice({
            customer_id: String(fd.get("customer_id")),
            contract_id: String(fd.get("contract_id")),
            subtotal: Number(fd.get("subtotal")),
            tax: Number(fd.get("tax") || 0),
            due_date: String(fd.get("due_date")),
            milestone_key: String(fd.get("milestone_key") || "") || undefined,
            description: String(fd.get("description")),
            performance_obligation_ref:
              String(fd.get("performance_obligation_ref") || "") || undefined,
            issue: true,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/billing/invoices/${result.id}`);
          router.refresh();
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Customer</span>
        <select
          name="customer_id"
          required
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Contract / event</span>
        <select
          name="contract_id"
          required
          defaultValue={defaultContract}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        >
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-[var(--muted)]">Description</span>
        <input
          name="description"
          required
          placeholder="Milestone / performance obligation"
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Subtotal</span>
        <input
          name="subtotal"
          type="number"
          min="0"
          step="0.01"
          required
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Tax</span>
        <input
          name="tax"
          type="number"
          min="0"
          step="0.01"
          defaultValue={0}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Due date</span>
        <input
          name="due_date"
          type="date"
          required
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">
          Milestone key (duplicate control)
        </span>
        <input
          name="milestone_key"
          placeholder="e.g. final-balance"
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-[var(--muted)]">
          Performance obligation ref
        </span>
        <input
          name="performance_obligation_ref"
          placeholder="PO-event"
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        />
      </label>
      {error ? (
        <p className="sm:col-span-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Issuing…" : "Issue invoice"}
        </button>
      </div>
    </form>
  );
}
