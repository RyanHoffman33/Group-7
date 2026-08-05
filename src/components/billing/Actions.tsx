"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acknowledgeAlert,
  applyDepositToInvoice,
  cancelInvoice,
  markInvoiceDisputed,
  recognizeRevenue,
  recordDeposit,
  recordPaymentAndApply,
  resolveInvoiceDispute,
  triggerAgingCheckAction,
  voidInvoice,
} from "@/features/billing/actions";

function ActionButton({
  label,
  pendingLabel,
  onRun,
  tone = "accent",
}: {
  label: string;
  pendingLabel?: string;
  onRun: () => Promise<{ ok: boolean; error?: string }>;
  tone?: "accent" | "danger" | "neutral";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const colors = {
    accent: "bg-[var(--accent)] text-white",
    danger: "bg-[var(--danger)] text-white",
    neutral: "border border-[var(--line)] bg-white text-[var(--ink)]",
  };

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${colors[tone]}`}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await onRun();
            if (!r.ok) setError(r.error ?? "Failed");
            else router.refresh();
          });
        }}
      >
        {pending ? pendingLabel ?? "Working…" : label}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export function InvoiceActions({
  invoiceId,
  canRecognize,
  canVoid,
  canDispute,
  canResolveDispute,
  canCancel,
}: {
  invoiceId: string;
  canRecognize: boolean;
  canVoid: boolean;
  canDispute: boolean;
  canResolveDispute: boolean;
  canCancel: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {canRecognize ? (
        <ActionButton
          label="Recognize revenue"
          onRun={() => recognizeRevenue(invoiceId)}
        />
      ) : null}
      {canDispute ? (
        <ActionButton
          label="Mark disputed"
          tone="neutral"
          onRun={() => markInvoiceDisputed(invoiceId, "Customer dispute")}
        />
      ) : null}
      {canResolveDispute ? (
        <ActionButton
          label="Resolve dispute"
          onRun={() => resolveInvoiceDispute(invoiceId)}
        />
      ) : null}
      {canCancel ? (
        <ActionButton
          label="Cancel"
          tone="neutral"
          onRun={() => cancelInvoice(invoiceId, "Canceled by billing")}
        />
      ) : null}
      {canVoid ? (
        <ActionButton
          label="Void invoice"
          tone="danger"
          onRun={() => voidInvoice(invoiceId)}
        />
      ) : null}
    </div>
  );
}

export function PaymentForm({
  customerId,
  invoiceId,
  maxApply,
}: {
  customerId: string;
  invoiceId: string;
  maxApply: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const amount = Number(fd.get("amount"));
          const apply = Number(fd.get("apply_amount"));
          const result = await recordPaymentAndApply({
            customer_id: customerId,
            invoice_id: invoiceId,
            amount,
            apply_amount: apply,
            paid_at: String(fd.get("paid_at")),
            method: String(fd.get("method")),
            reference: String(fd.get("reference") || "") || undefined,
          });
          if (!result.ok) setError(result.error);
          else {
            e.currentTarget.reset();
            router.refresh();
          }
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Payment amount</span>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={maxApply}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">
          Apply to invoice (max {maxApply.toFixed(2)})
        </span>
        <input
          name="apply_amount"
          type="number"
          step="0.01"
          min="0.01"
          max={maxApply}
          required
          defaultValue={maxApply}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Paid date</span>
        <input
          name="paid_at"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Method</span>
        <select
          name="method"
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          defaultValue="ach"
        >
          <option value="ach">ACH</option>
          <option value="wire">Wire</option>
          <option value="check">Check</option>
          <option value="card">Card</option>
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-[var(--muted)]">Reference</span>
        <input
          name="reference"
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      {error ? (
        <p className="sm:col-span-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending || maxApply <= 0}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"
      >
        {pending ? "Recording…" : "Record & apply payment"}
      </button>
    </form>
  );
}

export function DepositForm({
  customers,
  contracts,
}: {
  customers: { id: string; label: string }[];
  contracts: { id: string; label: string; customer_id: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const filtered = contracts.filter((c) => c.customer_id === customerId);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const result = await recordDeposit({
            customer_id: String(fd.get("customer_id")),
            contract_id: String(fd.get("contract_id")),
            amount: Number(fd.get("amount")),
            received_at: String(fd.get("received_at")),
          });
          if (!result.ok) setError(result.error);
          else {
            e.currentTarget.reset();
            router.refresh();
          }
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Customer</span>
        <select
          name="customer_id"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Contract</span>
        <select
          name="contract_id"
          required
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        >
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Amount</span>
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Received</span>
        <input
          name="received_at"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      {error ? (
        <p className="sm:col-span-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"
      >
        {pending ? "Saving…" : "Record unearned deposit"}
      </button>
    </form>
  );
}

export function ApplyDepositButton({
  depositId,
  invoiceId,
}: {
  depositId: string;
  invoiceId: string;
}) {
  return (
    <ActionButton
      label="Apply to invoice"
      onRun={() =>
        applyDepositToInvoice({ deposit_id: depositId, invoice_id: invoiceId })
      }
    />
  );
}

export function AcknowledgeButton({ alertId }: { alertId: string }) {
  return (
    <ActionButton
      label="Acknowledge"
      tone="neutral"
      onRun={() => acknowledgeAlert(alertId)}
    />
  );
}

export function RunAgingCheckButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await triggerAgingCheckAction();
            if (!r.ok) setMsg(r.error);
            else {
              setMsg(
                `Checked. ${r.transitions ?? 0} bucket transition(s) created.`,
              );
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Running aging check…" : "Run aging check"}
      </button>
      {msg ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{msg}</p>
      ) : null}
    </div>
  );
}
