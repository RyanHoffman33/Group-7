"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addAttachmentUrl,
  addTimeMaterial,
  approveException,
  checkInAssignment,
  completeAssignment,
  raiseException,
  rejectException,
} from "@/features/work/actions";
import type {
  ExceptionType,
  TimeMaterialEntryType,
  WorkParty,
} from "@/features/work/types";

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

export function CheckInButton({
  assignmentId,
  partyId,
}: {
  assignmentId: string;
  partyId?: string;
}) {
  return (
    <ActionButton
      label="Confirm arrival / start"
      pendingLabel="Checking in…"
      onRun={() => checkInAssignment(assignmentId, partyId)}
    />
  );
}

export function CompleteAssignmentForm({
  assignmentId,
  partyId,
}: {
  assignmentId: string;
  partyId?: string;
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
          const r = await completeAssignment({
            assignmentId,
            workNotes: String(fd.get("work_notes") || ""),
            performedByPartyId: partyId,
            completedBeforeApproval: fd.get("before_approval") === "on",
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else router.refresh();
        });
      }}
    >
      <label className="block text-sm">
        <span className="text-[var(--muted)]">Work performed</span>
        <textarea
          name="work_notes"
          required
          rows={3}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="Document what was completed…"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <input type="checkbox" name="before_approval" className="rounded" />
        Completed before manager approval (edge case)
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark complete"}
      </button>
      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </form>
  );
}

export function TimeMaterialForm({
  assignmentId,
  partyId,
}: {
  assignmentId: string;
  partyId?: string;
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
          const r = await addTimeMaterial({
            assignmentId,
            entryType: String(fd.get("entry_type")) as TimeMaterialEntryType,
            description: String(fd.get("description")),
            quantity: Number(fd.get("quantity") || 1),
            unitLabel: String(fd.get("unit_label") || "") || undefined,
            unitCost: Number(fd.get("unit_cost") || 0),
            hours: fd.get("hours")
              ? Number(fd.get("hours"))
              : undefined,
            notes: String(fd.get("notes") || "") || undefined,
            recordedByPartyId: partyId,
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else {
            (e.target as HTMLFormElement).reset();
            router.refresh();
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Type</span>
          <select
            name="entry_type"
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          >
            <option value="time">Time</option>
            <option value="materials">Materials</option>
            <option value="cost">Cost</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Hours (if time)</span>
          <input
            name="hours"
            type="number"
            step="0.25"
            min="0"
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">Description</span>
        <input
          name="description"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Qty</span>
          <input
            name="quantity"
            type="number"
            step="0.01"
            defaultValue={1}
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Unit</span>
          <input
            name="unit_label"
            placeholder="hours / units"
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Unit $</span>
          <input
            name="unit_cost"
            type="number"
            step="0.01"
            defaultValue={0}
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">Notes</span>
        <input
          name="notes"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record entry"}
      </button>
      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </form>
  );
}

export function AttachmentUrlForm({
  assignmentId,
  partyId,
}: {
  assignmentId: string;
  partyId?: string;
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
          const r = await addAttachmentUrl({
            assignmentId,
            fileName: String(fd.get("file_name")),
            externalUrl: String(fd.get("external_url")),
            uploadedByPartyId: partyId,
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else {
            (e.target as HTMLFormElement).reset();
            router.refresh();
          }
        });
      }}
    >
      <p className="text-xs text-[var(--muted)]">
        Demo: paste a URL (Storage upload can be wired later via{" "}
        <code className="text-[11px]">work-attachments</code> bucket).
      </p>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">File name</span>
        <input
          name="file_name"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="photo.jpg"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">URL</span>
        <input
          name="external_url"
          type="url"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="https://…"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Attach link"}
      </button>
      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </form>
  );
}

export function RaiseExceptionForm({
  contractId,
  assignmentId,
  parties,
  defaultSubmitterId,
}: {
  contractId: string;
  assignmentId?: string;
  parties: WorkParty[];
  defaultSubmitterId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const managers = parties.filter((p) => p.party_type === "manager");
  const submitters = parties.filter((p) =>
    ["crew", "vendor", "manager"].includes(p.party_type),
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await raiseException({
            contractId,
            assignmentId,
            exceptionType: String(fd.get("exception_type")) as ExceptionType,
            description: String(fd.get("description")),
            submittedByPartyId: String(fd.get("submitted_by")),
            approverPartyId: String(fd.get("approver")) || undefined,
            estimatedAmount: fd.get("estimated_amount")
              ? Number(fd.get("estimated_amount"))
              : undefined,
          });
          if (!r.ok) setError(r.error ?? "Failed");
          else {
            (e.target as HTMLFormElement).reset();
            router.refresh();
            router.push("/work/exceptions");
          }
        });
      }}
    >
      <label className="block text-sm">
        <span className="text-[var(--muted)]">Type</span>
        <select
          name="exception_type"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        >
          <option value="scope_addition">Ad hoc / scope addition</option>
          <option value="vendor_noshow">Vendor no-show</option>
          <option value="problem">On-site problem</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">Description</span>
        <textarea
          name="description"
          required
          rows={3}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="What happened? What approval is needed?"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Submitted by</span>
          <select
            name="submitted_by"
            defaultValue={defaultSubmitterId}
            required
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          >
            {submitters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} ({p.party_type})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Approver</span>
          <select
            name="approver"
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          >
            {managers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">Est. $ (optional)</span>
        <input
          name="estimated_amount"
          type="number"
          step="0.01"
          min="0"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--warn)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Request approval"}
      </button>
      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </form>
  );
}

export function ApproveExceptionButton({
  exceptionId,
}: {
  exceptionId: string;
}) {
  return (
    <ActionButton
      label="Approve (billable)"
      onRun={() =>
        approveException(
          exceptionId,
          "Approved — flagged billable_eligible for Billing handoff.",
        )
      }
    />
  );
}

export function RejectExceptionButton({
  exceptionId,
}: {
  exceptionId: string;
}) {
  return (
    <ActionButton
      label="Reject"
      tone="danger"
      onRun={() =>
        rejectException(exceptionId, "Rejected — not billable to client.")
      }
    />
  );
}
