"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  approveCostEntry,
  actualizeCostEntry,
  createExpenseEntry,
  createTimeEntryAction,
  rejectCostEntry,
  resolveCostFlags,
  updateCostEntry,
} from "@/features/costs/actions";
import {
  APPROVAL_THRESHOLD,
  EXPENSE_CATEGORIES,
  DEFAULT_LABOR_RATE,
  categoryLabel,
  type CostCategory,
} from "@/features/costs/config";
import type { CostCommitmentStatus, CostEntry } from "@/lib/supabase/types";

const fieldClass =
  "w-full rounded-md border border-[var(--line)] px-3 py-3 text-base text-[var(--ink)]";
const labelClass = "text-xs font-medium text-[var(--muted)]";

export function TimeEntryForm({
  contracts,
  teamMemberName,
  approvedHourlyRate = DEFAULT_LABOR_RATE,
}: {
  contracts: { id: string; event_name: string }[];
  teamMemberName?: string;
  approvedHourlyRate?: number;
}) {
  const rate = String(approvedHourlyRate);
  const [state, formAction, pending] = useActionState(
    createTimeEntryAction,
    null,
  );

  return (
    <form action={formAction} className="mx-auto max-w-md space-y-4">
      <p className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)]">
        Log hours for the signed-in team member. Amounts ≥ $
        {APPROVAL_THRESHOLD.toLocaleString()} go to the Approval Queue. Costs are
        recorded when incurred, not when paid.
      </p>

      <label className="block space-y-1.5">
        <span className={labelClass}>Event</span>
        <select name="contract_id" required className={fieldClass} defaultValue="">
          <option value="" disabled>
            Select event…
          </option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.event_name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Team member</span>
        <input
          name="worker_label"
          required
          readOnly
          className={`${fieldClass} bg-[#f7f9fb]`}
          value={teamMemberName || "Signed-in user"}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className={labelClass}>Hours</span>
          <input
            name="hours"
            type="number"
            min="0.25"
            step="0.25"
            required
            className={fieldClass}
            inputMode="decimal"
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Approved rate ($/hr)</span>
          <input
            name="rate"
            type="number"
            min="0"
            step="0.01"
            required
            readOnly
            value={rate}
            className={`${fieldClass} bg-[#f7f9fb]`}
            inputMode="decimal"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Work date</span>
        <input
          name="incurred_date"
          type="date"
          required
          className={fieldClass}
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Notes (optional)</span>
        <textarea name="notes" rows={2} className={fieldClass} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="sticky bottom-4 w-full rounded-md bg-[var(--accent)] px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Log time"}
      </button>
      {state?.error ? (
        <p className="text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}
    </form>
  );
}

export function ExpenseEntryForm({
  contracts,
  vendors,
}: {
  contracts: { id: string; event_name: string }[];
  vendors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CostCategory>("vendor");
  const [reimbursable, setReimbursable] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const needsOtherVendor = vendorId === "";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        setError(null);
        start(async () => {
          try {
            const selectedCategory = String(fd.get("category")) as CostCategory;
            const invoiceRef = String(fd.get("invoice_ref") || "").trim();
            const needsInvoice =
              selectedCategory === "vendor" ||
              selectedCategory === "contractor" ||
              selectedCategory === "materials" ||
              selectedCategory === "equipment";
            if (needsInvoice && !invoiceRef) {
              setError("Enter an invoice or reference number for this charge.");
              return;
            }
            const r = await createExpenseEntry({
              contract_id: String(fd.get("contract_id")),
              category: selectedCategory,
              amount: Number(fd.get("amount")),
              vendor_id: String(fd.get("vendor_id") || "") || undefined,
              vendor_name: String(fd.get("vendor_name") || "") || undefined,
              invoice_ref: invoiceRef,
              commitment_status: String(
                fd.get("commitment_status"),
              ) as CostCommitmentStatus,
              is_reimbursable:
                reimbursable || selectedCategory === "reimbursable",
              notes: String(fd.get("notes") || ""),
              entered_by: String(fd.get("entered_by") || "coordinator"),
              incurred_date: String(fd.get("incurred_date")),
            });
            if (!r.ok) {
              setError(r.error ?? "Failed");
              return;
            }
            if (r.id) {
              router.push(`/costs/entries/${r.id}`);
            } else {
              setCategory("vendor");
              setReimbursable(false);
              setVendorId("");
              router.refresh();
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <p className="text-xs text-[var(--muted)]">
        Record vendor and expense charges. Amounts ≥ $
        {APPROVAL_THRESHOLD.toLocaleString()} require approval. Use{" "}
        <strong>Committed</strong> for planned spend and <strong>Actual</strong>{" "}
        when the cost is incurred. Duplicate invoice numbers are flagged
        automatically.
      </p>

      <label className="block space-y-1">
        <span className={labelClass}>Event</span>
        <select name="contract_id" required className={fieldClass} defaultValue="">
          <option value="" disabled>
            Select event…
          </option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.event_name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className={labelClass}>Vendor</span>
        <select
          name="vendor_id"
          className={fieldClass}
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        >
          <option value="">Other vendor…</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      {needsOtherVendor ? (
        <label className="block space-y-1">
          <span className={labelClass}>Other vendor name</span>
          <input name="vendor_name" required className={fieldClass} />
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={labelClass}>Category</span>
          <select
            name="category"
            required
            className={fieldClass}
            value={category}
            onChange={(e) => {
              const next = e.target.value as CostCategory;
              setCategory(next);
              if (next === "reimbursable") setReimbursable(true);
            }}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>Amount</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={labelClass}>Invoice / reference #</span>
          <input name="invoice_ref" className={fieldClass} />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>Status</span>
          <select
            name="commitment_status"
            required
            className={fieldClass}
            defaultValue="committed"
          >
            <option value="committed">Committed</option>
            <option value="actual">Actual</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className={labelClass}>Incurred / commit date</span>
        <input
          name="incurred_date"
          type="date"
          required
          className={fieldClass}
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={reimbursable}
          onChange={(e) => setReimbursable(e.target.checked)}
        />
        Reimbursable / passthrough (exclude from margin)
        {category === "reimbursable" ? " — required for this category" : ""}
      </label>

      <label className="block space-y-1">
        <span className={labelClass}>Entered by</span>
        <input
          name="entered_by"
          className={fieldClass}
          defaultValue="coordinator"
        />
      </label>

      <label className="block space-y-1">
        <span className={labelClass}>Notes</span>
        <textarea name="notes" rows={2} className={fieldClass} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Log expense"}
      </button>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}

export function ApprovalActions({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          if (!confirm("Approve this cost entry?")) return;
          setError(null);
          start(async () => {
            const r = await approveCostEntry(entryId);
            if (!r.ok) setError(r.error ?? "Failed");
            else router.refresh();
          });
        }}
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-60"
        onClick={() => {
          if (!confirm("Reject this cost entry?")) return;
          const reason = window.prompt("Rejection reason (required):");
          if (reason == null) return;
          if (!reason.trim()) {
            setError("A rejection reason is required.");
            return;
          }
          setError(null);
          start(async () => {
            const r = await rejectCostEntry(entryId, reason.trim());
            if (!r.ok) setError(r.error ?? "Failed");
            else router.refresh();
          });
        }}
      >
        Reject
      </button>
      {error ? (
        <p className="w-full text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export function ActualizeCostButton({
  entryId,
  committedAmount,
}: {
  entryId: string;
  committedAmount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(committedAmount));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">Actual amount</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-md border border-[var(--line)] px-2 py-1.5 text-sm text-[var(--ink)]"
        />
      </label>
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          if (!confirm("Record actual cost for this commitment?")) return;
          setError(null);
          start(async () => {
            const r = await actualizeCostEntry({
              id: entryId,
              actual_amount: Number(amount),
            });
            if (!r.ok) setError(r.error ?? "Failed");
            else router.refresh();
          });
        }}
      >
        {pending ? "Saving…" : "Record Actual Cost"}
      </button>
      {error ? (
        <p className="w-full text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export function ResolveFlagsForm({
  entryId,
  compact = false,
}: {
  entryId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  return (
    <form
      className={compact ? "space-y-2" : "space-y-3"}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (note.trim().length < 8) {
          setError("Add a short note explaining how this was resolved.");
          return;
        }
        start(async () => {
          const r = await resolveCostFlags(entryId, {
            note: note.trim(),
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else {
            setNote("");
            router.refresh();
          }
        });
      }}
    >
      <label className="block space-y-1">
        <span className={labelClass}>Resolution note</span>
        <textarea
          rows={compact ? 2 : 3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={fieldClass}
          placeholder="What was corrected or why this is OK…"
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark resolved"}
      </button>
      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </form>
  );
}

export function CostEditForm({ entry }: { entry: CostEntry }) {
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
          const r = await updateCostEntry({
            id: entry.id,
            notes: String(fd.get("notes") || ""),
            commitment_status: String(
              fd.get("commitment_status"),
            ) as CostCommitmentStatus,
            amount:
              entry.entry_type === "vendor_expense"
                ? Number(fd.get("amount"))
                : undefined,
            hours:
              entry.entry_type === "labor"
                ? Number(fd.get("hours"))
                : undefined,
            rate:
              entry.entry_type === "labor" ? Number(fd.get("rate")) : undefined,
            invoice_ref: String(fd.get("invoice_ref") || ""),
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else router.refresh();
        });
      }}
    >
      {entry.entry_type === "labor" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className={labelClass}>Hours</span>
            <input
              name="hours"
              type="number"
              step="0.25"
              min="0.25"
              defaultValue={entry.hours ?? undefined}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1">
            <span className={labelClass}>Rate</span>
            <input
              name="rate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={entry.rate ?? undefined}
              className={fieldClass}
            />
          </label>
        </div>
      ) : (
        <>
          <label className="block space-y-1">
            <span className={labelClass}>Amount</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={entry.amount}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1">
            <span className={labelClass}>Invoice / reference #</span>
            <input
              name="invoice_ref"
              defaultValue={entry.invoice_ref ?? ""}
              className={fieldClass}
            />
          </label>
        </>
      )}

      <label className="block space-y-1">
        <span className={labelClass}>Commitment status</span>
        <select
          name="commitment_status"
          defaultValue={entry.commitment_status}
          className={fieldClass}
        >
          <option value="committed">Committed</option>
          <option value="actual">Actual</option>
        </select>
      </label>

      <label className="block space-y-1">
        <span className={labelClass}>Notes</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={entry.notes ?? ""}
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}
