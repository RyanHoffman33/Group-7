"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { raiseException } from "@/features/work/actions";
import {
  EXCEPTION_SCOPE_CONTRACT,
  type ExceptionType,
} from "@/features/work/types";

export type ExceptionObligationOption = {
  id: string;
  obligationNumber: number;
  title: string;
  deliverableId: string | null;
  /** Nearest assignment for this deliverable, if any */
  assignmentId: string | null;
};

export type ExceptionPartyOption = {
  id: string;
  display_name: string;
  party_type: string;
};

const TYPE_OPTIONS: { value: ExceptionType; label: string }[] = [
  { value: "vendor_noshow", label: "Vendor no-show" },
  { value: "scope_addition", label: "Scope addition" },
  { value: "problem", label: "Problem / issue" },
  { value: "other", label: "Other" },
];

export function ExceptionWizard({
  contractId,
  obligations,
  parties,
}: {
  contractId: string;
  obligations: ExceptionObligationOption[];
  parties: ExceptionPartyOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [exceptionType, setExceptionType] =
    useState<ExceptionType>("problem");
  const [relateTo, setRelateTo] = useState<string>("contract");
  const [submitterId, setSubmitterId] = useState(
    () =>
      parties.find((p) => p.party_type === "crew" || p.party_type === "vendor")
        ?.id ??
      parties[0]?.id ??
      "",
  );
  const [description, setDescription] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const submitters = parties.filter((p) =>
    ["crew", "vendor", "manager"].includes(p.party_type),
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setMsg(null);
        if (!description.trim()) {
          setError("Describe what happened.");
          return;
        }
        if (!submitterId) {
          setError("Select who is submitting.");
          return;
        }

        const selectedOb =
          relateTo === "contract"
            ? null
            : (obligations.find((o) => o.id === relateTo) ?? null);

        const scopeLabel = selectedOb
          ? `#${selectedOb.obligationNumber} — ${selectedOb.title}`
          : EXCEPTION_SCOPE_CONTRACT;

        const assignmentId = selectedOb?.assignmentId || undefined;

        start(async () => {
          const amount = estimatedAmount.trim()
            ? Number(estimatedAmount)
            : undefined;
          const r = await raiseException({
            contractId,
            assignmentId,
            exceptionType,
            description: `[${scopeLabel}] ${description.trim()}`,
            submittedByPartyId: submitterId,
            estimatedAmount:
              amount != null && !Number.isNaN(amount) ? amount : undefined,
            evidenceUrl: evidenceUrl.trim() || undefined,
          });
          if (!r.ok) {
            setError(r.error ?? "Failed to submit exception");
            return;
          }
          setMsg("Sent to the exceptions inbox for review.");
          setDescription("");
          setEstimatedAmount("");
          setEvidenceUrl("");
          setRelateTo("contract");
          setExceptionType("problem");
          router.refresh();
          router.push("/work/exceptions");
        });
      }}
    >
      <p className="text-sm text-[var(--muted)]">
        Answer the questions below. Submissions go to the exceptions inbox as
        pending approval — reviewers decide whether the item is billable.
      </p>

      <label className="block text-sm">
        <span className="text-[var(--muted)]">
          1. What kind of exception is this?
        </span>
        <select
          required
          value={exceptionType}
          onChange={(e) =>
            setExceptionType(e.target.value as ExceptionType)
          }
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-[var(--muted)]">
          2. What does this relate to?
        </span>
        <select
          required
          value={relateTo}
          onChange={(e) => setRelateTo(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        >
          <option value="contract">
            Engagement-wide (exception to contract)
          </option>
          {obligations.map((o) => (
            <option key={o.id} value={o.id}>
              #{o.obligationNumber} — {o.title}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-[var(--muted)]">3. Who is submitting this?</span>
        <select
          required
          value={submitterId}
          onChange={(e) => setSubmitterId(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        >
          {submitters.length === 0 ? (
            <option value="">No parties available</option>
          ) : (
            submitters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} ({p.party_type})
              </option>
            ))
          )}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-[var(--muted)]">4. What happened?</span>
        <textarea
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="e.g. Centerpiece count was 40 on the pull sheet; only 32 arrived"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[var(--muted)]">
          5. Estimated cost impact? (optional)
        </span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={estimatedAmount}
          onChange={(e) => setEstimatedAmount(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="Leave blank if unknown"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[var(--muted)]">
          6. Evidence link? (optional)
        </span>
        <input
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="https://…"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--warn)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send to exceptions inbox"}
      </button>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {msg ? <p className="text-xs text-[var(--ok)]">{msg}</p> : null}
    </form>
  );
}
