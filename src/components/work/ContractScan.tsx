"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactNode } from "react";
import {
  attachAndScanSampleContract,
  attachContractDocument,
  saveManualObligations,
  scanContractDocument,
  type ManualObligationInput,
} from "@/features/work/actions";
import type {
  ObligationWithResources,
  WorkContractDocument,
} from "@/features/work/types";
import { StatusPill } from "@/components/billing/ui";
import { formatCurrency } from "@/features/billing/aging";

type EntryMode = "choose" | "ai" | "manual";

export function ContractEntryPanel({
  contractId,
  eventName,
  customerName,
  documents,
  parties,
  defaultCustomerContact,
}: {
  contractId: string;
  eventName: string;
  customerName: string;
  documents: WorkContractDocument[];
  parties: { id: string; display_name: string; party_type: string }[];
  defaultCustomerContact?: { name: string | null; email: string | null };
}) {
  const [mode, setMode] = useState<EntryMode>(
    documents.length > 0 ? "choose" : "choose",
  );

  return (
    <div className="space-y-4">
      {documents.length > 0 ? (
        <DocumentList documents={documents} />
      ) : null}

      {mode === "choose" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("ai")}
            className="rounded-lg border border-[var(--line)] bg-white p-4 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <p className="font-semibold text-[var(--ink)]">
              I have the contract
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Paste or drop the agreement text. AI extracts obligations,
              manpower, and supplies. This becomes the dashboard count for this
              engagement.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="rounded-lg border border-[var(--line)] bg-white p-4 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <p className="font-semibold text-[var(--ink)]">
              I&apos;ll answer questions
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              No document yet — walk through what MainEvent must deliver, who
              works it, and what supplies are needed.
            </p>
          </button>
        </div>
      ) : null}

      {mode === "ai" ? (
        <div className="space-y-3">
          <button
            type="button"
            className="text-sm text-[var(--accent)] hover:underline"
            onClick={() => setMode("choose")}
          >
            ← Choose a different path
          </button>
          <AiContractPath
            contractId={contractId}
            eventName={eventName}
            customerName={customerName}
          />
        </div>
      ) : null}

      {mode === "manual" ? (
        <div className="space-y-3">
          <button
            type="button"
            className="text-sm text-[var(--accent)] hover:underline"
            onClick={() => setMode("choose")}
          >
            ← Choose a different path
          </button>
          <ManualObligationWizard
            contractId={contractId}
            parties={parties}
            defaultCustomerContact={defaultCustomerContact}
          />
        </div>
      ) : null}
    </div>
  );
}

function AiContractPath({
  contractId,
  eventName,
  customerName,
}: {
  contractId: string;
  eventName: string;
  customerName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (
      file.type.startsWith("text/") ||
      /\.(txt|md|csv|json)$/i.test(file.name)
    ) {
      const reader = new FileReader();
      reader.onload = () => setText(String(reader.result || ""));
      reader.readAsText(file);
    } else {
      setError(
        "For PDFs/Word, paste the contract text below (browser can’t read those formats here). Or use the questions path.",
      );
    }
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onDrop(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm ${
          dragOver
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--line)] bg-[var(--bg)]"
        }`}
      >
        <p className="font-medium text-[var(--ink)]">
          Drop a .txt contract here, or paste below
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {fileName ? `Loaded: ${fileName}` : "PDF/Docx → paste text for now"}
        </p>
        <label className="mt-3 inline-block cursor-pointer text-[var(--accent)] hover:underline">
          Browse file
          <input
            type="file"
            accept=".txt,.md,.csv,text/plain"
            className="hidden"
            onChange={(e) => onDrop(e.target.files)}
          />
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        className="w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs"
        placeholder="Paste the full engagement agreement / SOW…"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !text.trim()}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => {
            setError(null);
            setMsg(null);
            start(async () => {
              const attached = await attachContractDocument({
                contractId,
                title: `${eventName} engagement agreement`,
                fileName: fileName || undefined,
                contractText: text,
              });
              if (!attached.ok || !attached.id) {
                setError(!attached.ok ? attached.error : "Attach failed");
                return;
              }
              const scanned = await scanContractDocument(attached.id);
              if (!scanned.ok) {
                setError(scanned.error);
                return;
              }
              setMsg(
                "Scanned. Dashboard counts now use these AI obligations for this engagement.",
              );
              router.refresh();
            });
          }}
        >
          {pending ? "Scanning…" : "Scan with AI"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
          onClick={() => {
            setError(null);
            setMsg(null);
            start(async () => {
              const r = await attachAndScanSampleContract(
                contractId,
                eventName,
                customerName,
              );
              if (!r.ok) setError(r.error);
              else {
                setMsg("Sample contract scanned.");
                router.refresh();
              }
            });
          }}
        >
          Try sample contract
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Scanning replaces prior obligations for this engagement (AI or manual)
        so the board stays in sync. Optional: add{" "}
        <code className="text-[11px]">GEMINI_API_KEY</code> for fuller LLM
        extraction.
      </p>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {msg ? <p className="text-xs text-[var(--ok)]">{msg}</p> : null}
    </div>
  );
}

function ManualObligationWizard({
  contractId,
  parties,
  defaultCustomerContact,
}: {
  contractId: string;
  parties: { id: string; display_name: string; party_type: string }[];
  defaultCustomerContact?: { name: string | null; email: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const defaultAssignee =
    parties.find((p) => p.party_type === "crew" || p.party_type === "vendor")
      ?.id ?? parties[0]?.id ?? "";
  const [drafts, setDrafts] = useState<ManualObligationInput[]>([
    {
      title: "",
      description: "",
      phase: "planning",
      crewCount: 2,
      suppliesNote: "",
      assigneePartyId: defaultAssignee,
      customerContactName: defaultCustomerContact?.name ?? "",
      customerContactEmail: defaultCustomerContact?.email ?? "",
    },
  ]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setMsg(null);
        const cleaned = drafts
          .map((d) => ({
            ...d,
            title: d.title.trim(),
            description: d.description?.trim(),
            suppliesNote: d.suppliesNote?.trim(),
            customerContactName: d.customerContactName?.trim(),
            customerContactEmail: d.customerContactEmail?.trim(),
          }))
          .filter((d) => d.title);
        start(async () => {
          const r = await saveManualObligations({
            contractId,
            obligations: cleaned,
          });
          if (!r.ok) setError(r.error);
          else {
            setMsg(
              "Saved. Dashboard counts now use these numbered obligations.",
            );
            router.refresh();
          }
        });
      }}
    >
      <p className="text-sm text-[var(--muted)]">
        Each answer becomes a numbered performance obligation (PO-1, PO-2, …).
        Saving replaces prior obligations for this engagement.
      </p>

      {drafts.map((d, i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-[var(--line)] bg-white p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Obligation #{i + 1}
          </p>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Name — what must MainEvent deliver?</span>
            <input
              required={i === 0}
              value={d.title}
              onChange={(e) => {
                const next = [...drafts];
                next[i] = { ...d, title: e.target.value };
                setDrafts(next);
              }}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="e.g. AV package & show-call operation"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Which phase?</span>
            <select
              value={d.phase}
              onChange={(e) => {
                const next = [...drafts];
                next[i] = {
                  ...d,
                  phase: e.target.value as ManualObligationInput["phase"],
                };
                setDrafts(next);
              }}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            >
              <option value="planning">Planning / prep</option>
              <option value="execution">Live execution</option>
              <option value="wrapup">Wrap-up</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Details</span>
            <textarea
              value={d.description}
              onChange={(e) => {
                const next = [...drafts];
                next[i] = { ...d, description: e.target.value };
                setDrafts(next);
              }}
              rows={2}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="Acceptance criteria, timing, location notes…"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Person assigned</span>
              <select
                value={d.assigneePartyId ?? ""}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...d, assigneePartyId: e.target.value };
                  setDrafts(next);
                }}
                className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              >
                <option value="">Select assignee</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.party_type})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">How many people (crew)?</span>
              <input
                type="number"
                min={0}
                value={d.crewCount ?? 0}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...d, crewCount: Number(e.target.value) };
                  setDrafts(next);
                }}
                className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Customer contact name</span>
              <input
                value={d.customerContactName ?? ""}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...d, customerContactName: e.target.value };
                  setDrafts(next);
                }}
                className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Customer contact email</span>
              <input
                type="email"
                value={d.customerContactEmail ?? ""}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...d, customerContactEmail: e.target.value };
                  setDrafts(next);
                }}
                className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">
                Supplies needed (comma-separated, if applicable)
              </span>
              <input
                value={d.suppliesNote}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...d, suppliesNote: e.target.value };
                  setDrafts(next);
                }}
                className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="LED wall, mics, centerpieces"
              />
            </label>
          </div>
          {drafts.length > 1 ? (
            <button
              type="button"
              className="text-xs text-[var(--danger)] hover:underline"
              onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
            >
              Remove this obligation
            </button>
          ) : null}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold"
          onClick={() =>
            setDrafts([
              ...drafts,
              {
                title: "",
                description: "",
                phase: "execution",
                crewCount: 2,
                suppliesNote: "",
                assigneePartyId: defaultAssignee,
                customerContactName: defaultCustomerContact?.name ?? "",
                customerContactEmail: defaultCustomerContact?.email ?? "",
              },
            ])
          }
        >
          Add another obligation
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save obligations"}
        </button>
      </div>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {msg ? <p className="text-xs text-[var(--ok)]">{msg}</p> : null}
    </form>
  );
}

export function RescanButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await scanContractDocument(documentId);
            if (!r.ok) setError(r.error);
            else router.refresh();
          });
        }}
      >
        {pending ? "Scanning…" : "Re-scan"}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export function ObligationStatusCard({
  obligation,
  footer,
  displayNumber,
}: {
  obligation: ObligationWithResources;
  footer?: ReactNode;
  /** Override badge number (completion sequence). Defaults to obligation_number. */
  displayNumber?: number;
}) {
  const num =
    displayNumber ??
    (obligation.obligation_number ||
      Number(String(obligation.code).replace(/\D+/g, "")) ||
      obligation.sort_order ||
      0);
  const supplies = obligation.resources.filter(
    (r) => r.resource_type !== "manpower",
  );
  const tone =
    obligation.status === "completed"
      ? ("ok" as const)
      : obligation.status === "in_progress" ||
          obligation.status === "scheduled"
        ? ("accent" as const)
        : obligation.status === "waived"
          ? ("neutral" as const)
          : ("warn" as const);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-[var(--accent)] px-2 text-sm font-bold text-white">
            #{num}
          </span>
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Deliverable · {obligation.phase}
            </p>
            <h4 className="font-semibold text-[var(--ink)]">
              {obligation.title}
            </h4>
          </div>
        </div>
        <StatusPill tone={tone}>{obligation.status}</StatusPill>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Name" value={obligation.title} />
        <Field
          label="Person assigned"
          value={obligation.assignee_name ?? "Unassigned"}
        />
        <Field
          label="Details"
          value={
            obligation.description ||
            obligation.acceptance_criteria ||
            "No additional details"
          }
          className="sm:col-span-2"
        />
        <Field
          label="Customer contact"
          value={
            obligation.customer_contact_name ||
            obligation.customer_contact_email
              ? [
                  obligation.customer_contact_name,
                  obligation.customer_contact_email,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Not set"
          }
        />
        <Field
          label="Costs associated"
          value={
            obligation.total_cost_estimate > 0
              ? `${formatCurrency(obligation.total_cost_estimate)} est. (labor ${formatCurrency(obligation.labor_cost_estimate)} · supplies ${formatCurrency(obligation.supply_cost_estimate)})`
              : "No cost estimate yet"
          }
        />
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Supplies needed
          </p>
          {supplies.length > 0 ? (
            <ul className="mt-1 space-y-1 text-sm text-[var(--ink)]">
              {supplies.map((r) => (
                <li key={r.id}>
                  {r.label}
                  <span className="text-[var(--muted)]">
                    {r.quantity > 1 ? ` ×${r.quantity}` : ""}
                    {r.unit ? ` ${r.unit}` : ""}
                    {r.estimated_unit_cost
                      ? ` · ${formatCurrency(r.quantity * r.estimated_unit_cost)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted)]">
              None / not applicable
            </p>
          )}
        </div>
      </div>
      {footer ? <div className="border-t border-[var(--line)] px-4 py-3">{footer}</div> : null}
    </div>
  );
}

/** Operational deliverable that is not a numbered contract PO — same card fields. */
export function WorkItemStatusCard({
  displayNumber,
  code,
  title,
  details,
  status,
  personAssigned,
  customerContact,
  location,
  footer,
}: {
  displayNumber: number;
  code: string;
  title: string;
  details: string | null;
  status: string;
  personAssigned: string | null;
  customerContact: string | null;
  location?: string | null;
  footer?: ReactNode;
}) {
  const tone =
    status === "completed"
      ? ("ok" as const)
      : status === "in_progress" || status === "scheduled"
        ? ("accent" as const)
        : status === "promised" || status === "identified"
          ? ("warn" as const)
          : ("neutral" as const);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[#f7f7f5] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-[var(--ink)] px-2 text-sm font-bold text-white">
            #{displayNumber}
          </span>
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Work item · {code}
            </p>
            <h4 className="font-semibold text-[var(--ink)]">{title}</h4>
          </div>
        </div>
        <StatusPill tone={tone}>{status}</StatusPill>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Name" value={title} />
        <Field label="Person assigned" value={personAssigned ?? "Unassigned"} />
        <Field
          label="Details"
          value={
            [details, location ? `Location: ${location}` : null]
              .filter(Boolean)
              .join(" · ") || "No additional details"
          }
          className="sm:col-span-2"
        />
        <Field
          label="Customer contact"
          value={customerContact ?? "Not set"}
        />
        <Field label="Costs associated" value="No cost estimate on this work item" />
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Supplies needed
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            None / not applicable
          </p>
        </div>
      </div>
      {footer ? <div className="border-t border-[var(--line)] px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function ObligationCards({
  obligations,
}: {
  obligations: ObligationWithResources[];
}) {
  if (obligations.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No obligations yet. Attach a contract or answer the guided questions
        above — those feed the dashboard counts.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {obligations.map((o) => (
        <li key={o.id}>
          <ObligationStatusCard obligation={o} />
        </li>
      ))}
    </ul>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm text-[var(--ink)]">{value}</p>
    </div>
  );
}

function DocumentList({
  documents,
}: {
  documents: WorkContractDocument[];
}) {
  return (
    <ul className="space-y-2 text-sm">
      {documents.map((d) => (
        <li
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--line)] px-3 py-2"
        >
          <div>
            <p className="font-medium">{d.title}</p>
            <p className="text-xs text-[var(--muted)]">
              {d.file_name ?? "pasted text"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill
              tone={
                d.scan_status === "scanned"
                  ? "ok"
                  : d.scan_status === "failed"
                    ? "danger"
                    : "warn"
              }
            >
              {d.scan_status}
            </StatusPill>
            <RescanButton documentId={d.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
