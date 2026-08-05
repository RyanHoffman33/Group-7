"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addRecognitionEvidence,
  applyModification,
  approveModification,
  createModificationDraft,
  upsertCostClassification,
} from "@/features/gaap/actions";
import type {
  CostClassificationType,
  EvidenceType,
  ModAccountingTreatment,
} from "@/lib/supabase/types";

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

export function ApproveModButton({ modId }: { modId: string }) {
  return (
    <ActionButton
      label="Approve"
      tone="neutral"
      onRun={() => approveModification(modId)}
    />
  );
}

export function ApplyModButton({ modId }: { modId: string }) {
  return (
    <ActionButton
      label="Apply treatment"
      onRun={() => applyModification(modId)}
    />
  );
}

export function EvidenceForm({
  contracts,
}: {
  contracts: { id: string; event_name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await addRecognitionEvidence({
            contract_id: String(fd.get("contract_id")),
            invoice_id: String(fd.get("invoice_id") || "") || undefined,
            evidence_type: String(fd.get("evidence_type")) as EvidenceType,
            evidence_date: String(fd.get("evidence_date")),
            description: String(fd.get("description")),
            supporting_ref: String(fd.get("supporting_ref") || "") || undefined,
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else {
            e.currentTarget.reset();
            router.refresh();
          }
        });
      }}
    >
      <label className="block text-xs font-medium text-[var(--muted)]">
        Contract
        <select
          name="contract_id"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        >
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.event_name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Invoice id (optional)
        <input
          name="invoice_id"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="UUID"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Evidence type
        <select
          name="evidence_type"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          defaultValue="event_completion"
        >
          <option value="customer_approval">Customer approval</option>
          <option value="event_completion">Event completion</option>
          <option value="milestone_signoff">Milestone sign-off</option>
          <option value="delivery_acceptance">Delivery acceptance</option>
          <option value="time_sheet">Time sheet</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Date
        <input
          type="date"
          name="evidence_date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Description
        <textarea
          name="description"
          required
          rows={2}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Supporting ref
        <input
          name="supporting_ref"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="DOC-…"
        />
      </label>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add evidence"}
      </button>
    </form>
  );
}

export function ModDraftForm({
  contracts,
}: {
  contracts: { id: string; event_name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await createModificationDraft({
            contract_id: String(fd.get("contract_id")),
            mod_number: String(fd.get("mod_number")),
            effective_date: String(fd.get("effective_date")),
            description: String(fd.get("description")),
            price_change: Number(fd.get("price_change")),
            scope_change_notes: String(fd.get("scope_change_notes") || "") || undefined,
            accounting_treatment: String(
              fd.get("accounting_treatment"),
            ) as ModAccountingTreatment,
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else {
            e.currentTarget.reset();
            router.refresh();
          }
        });
      }}
    >
      <label className="block text-xs font-medium text-[var(--muted)]">
        Contract
        <select
          name="contract_id"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        >
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.event_name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Mod number
        <input
          name="mod_number"
          required
          placeholder="CO-002"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Effective date
        <input
          type="date"
          name="effective_date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Price change
        <input
          type="number"
          step="0.01"
          name="price_change"
          required
          defaultValue={0}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Treatment
        <select
          name="accounting_treatment"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          defaultValue="prospective"
        >
          <option value="prospective">Prospective</option>
          <option value="cumulative_catchup">Cumulative catch-up</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Description
        <textarea
          name="description"
          required
          rows={2}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Scope notes
        <textarea
          name="scope_change_notes"
          rows={2}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Create draft mod"}
      </button>
    </form>
  );
}

export function CostClassificationForm({
  contracts,
}: {
  contracts: { id: string; event_name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await upsertCostClassification({
            cost_ref_id: String(fd.get("cost_ref_id")),
            contract_id: String(fd.get("contract_id")),
            classification: String(
              fd.get("classification"),
            ) as CostClassificationType,
            period: String(fd.get("period")),
            amount: Number(fd.get("amount")),
            notes: String(fd.get("notes") || "") || undefined,
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else {
            e.currentTarget.reset();
            router.refresh();
          }
        });
      }}
    >
      <label className="block text-xs font-medium text-[var(--muted)]">
        Contract
        <select
          name="contract_id"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        >
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.event_name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Cost ref id
        <input
          name="cost_ref_id"
          required
          placeholder="UUID from Walker / billable_costs"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Classification
        <select
          name="classification"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          defaultValue="direct_event_cogs"
        >
          <option value="direct_event_cogs">Direct event COGS</option>
          <option value="reimbursable_passthrough">Reimbursable passthrough</option>
          <option value="overhead">Overhead</option>
          <option value="selling">Selling</option>
          <option value="capitalizable">Capitalizable</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Period
        <input
          type="date"
          name="period"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Amount
        <input
          type="number"
          step="0.01"
          min="0"
          name="amount"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--muted)]">
        Notes
        <input
          name="notes"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Classify cost"}
      </button>
    </form>
  );
}

export function AuditExportButton({
  packJson,
}: {
  packJson: string;
}) {
  type LedgerRow = {
    created_at: string;
    entry_type: string;
    invoice_number: string | null;
    debit: number;
    credit: number;
    memo: string | null;
  };

  /** Map ledger entry types → QuickBooks-style account pairs for import. */
  function qboAccounts(entryType: string): {
    account: string;
    offsetAccount: string;
  } {
    switch (entryType) {
      case "deposit_receive":
        return { account: "Undeposited Funds", offsetAccount: "Unearned Revenue" };
      case "deposit_apply":
        return { account: "Unearned Revenue", offsetAccount: "Accounts Receivable" };
      case "invoice":
      case "invoice_issue":
        return { account: "Accounts Receivable", offsetAccount: "Contract Revenue" };
      case "payment":
      case "payment_apply":
        return { account: "Undeposited Funds", offsetAccount: "Accounts Receivable" };
      case "recognition":
      case "revenue_recognize":
        return { account: "Contract Liability", offsetAccount: "Contract Revenue" };
      case "contract_modification":
        return { account: "Accounts Receivable", offsetAccount: "Contract Revenue" };
      default:
        return { account: "Accounts Receivable", offsetAccount: "Contract Revenue" };
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
        onClick={() => {
          const blob = new Blob([packJson], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `gaap-audit-pack-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Export JSON
      </button>
      <button
        type="button"
        className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--ink)]"
        onClick={() => {
          const pack = JSON.parse(packJson) as { ledger: LedgerRow[] };
          const header =
            "created_at,entry_type,invoice_number,debit,credit,memo\n";
          const rows = pack.ledger
            .map((l) =>
              [
                l.created_at,
                l.entry_type,
                l.invoice_number ?? "",
                l.debit,
                l.credit,
                `"${(l.memo ?? "").replace(/"/g, '""')}"`,
              ].join(","),
            )
            .join("\n");
          const blob = new Blob([header + rows], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `gaap-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Export ledger CSV
      </button>
      <button
        type="button"
        className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--ink)]"
        title="Journal CSV mapped to common QuickBooks Online accounts for manual import"
        onClick={() => {
          const pack = JSON.parse(packJson) as { ledger: LedgerRow[] };
          const header =
            "JournalNo,JournalDate,Account,Debit,Credit,Description,Name,Currency\n";
          const rows: string[] = [];
          pack.ledger.forEach((l, i) => {
            const jn = `ME-${String(i + 1).padStart(4, "0")}`;
            const date = (l.created_at ?? "").slice(0, 10);
            const amt = Math.max(Number(l.debit) || 0, Number(l.credit) || 0);
            if (amt <= 0 && l.entry_type !== "contract_modification") return;
            const { account, offsetAccount } = qboAccounts(l.entry_type);
            const memo = `"${(l.memo ?? l.entry_type).replace(/"/g, '""')}"`;
            const name = l.invoice_number ? `"${l.invoice_number}"` : '""';
            const debitSide = Number(l.debit) >= Number(l.credit);
            const primaryDebit = debitSide ? amt || Number(l.debit) : 0;
            const primaryCredit = debitSide ? 0 : amt || Number(l.credit);
            rows.push(
              [
                jn,
                date,
                `"${account}"`,
                primaryDebit,
                primaryCredit,
                memo,
                name,
                "USD",
              ].join(","),
            );
            rows.push(
              [
                jn,
                date,
                `"${offsetAccount}"`,
                primaryCredit,
                primaryDebit,
                memo,
                name,
                "USD",
              ].join(","),
            );
          });
          const blob = new Blob([header + rows.join("\n")], {
            type: "text/csv",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `qbo-journal-import-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Export QuickBooks journal CSV
      </button>
    </div>
  );
}
