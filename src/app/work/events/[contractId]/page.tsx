import Link from "next/link";
import { notFound } from "next/navigation";
import {
  daysUntilEvent,
  ensureObligationsCoverDeliverables,
  getWorkEventStatus,
  listActiveWorkParties,
  listAssignmentsForContract,
  listContractDocuments,
  listDeliverablesForContract,
  listExceptions,
  listObligationsForContract,
} from "@/features/work/queries";
import type {
  DeliverablePhase,
  ObligationWithResources,
  WorkAssignment,
  WorkExceptionRow,
} from "@/features/work/types";
import { EXCEPTION_SCOPE_CONTRACT } from "@/features/work/types";
import { formatCurrency } from "@/features/billing/aging";
import { Panel, StatCard, StatusPill } from "@/components/billing/ui";
import {
  ContractEntryPanel,
  ObligationStatusCard,
} from "@/components/work/ContractScan";
import { EngagementHeaderWithException } from "@/components/work/ExceptionReportToggle";
import { canStartWork, STATUS_LABELS } from "@/features/contracts/status";
import type { ContractStatus } from "@/features/contracts/status";

export const dynamic = "force-dynamic";

const phaseMeta: Record<
  DeliverablePhase,
  { title: string; hint: string; urgent?: boolean }
> = {
  planning: {
    title: "Planning / Prep",
    hint: "Advance performance before event day",
  },
  execution: {
    title: "Live Execution",
    hint: "Event-day performance — keep this streamlined",
    urgent: true,
  },
  wrapup: {
    title: "Wrap-up / Reconciliation",
    hint: "Strike, evidence, and satisfaction close-out",
  },
};

const PHASE_RANK: Record<DeliverablePhase, number> = {
  planning: 1,
  execution: 2,
  wrapup: 3,
};

const TYPE_LABELS: Record<string, string> = {
  vendor_noshow: "Vendor no-show",
  scope_addition: "Scope addition",
  problem: "Problem / issue",
  other: "Other",
};

function statusTone(
  status: string,
): "neutral" | "ok" | "warn" | "danger" | "accent" {
  if (status === "completed") return "ok";
  if (status === "in_progress" || status === "checked_in") return "accent";
  if (status === "blocked") return "danger";
  if (status === "promised" || status === "identified") return "warn";
  if (status === "approved") return "ok";
  if (status === "rejected") return "danger";
  if (status === "pending_approval" || status === "submitted") return "warn";
  return "neutral";
}

function riskHint(row: {
  outstanding_pct: number;
  pending_exceptions: number;
  event_end: string | null;
  event_start: string | null;
}): string | null {
  const days = daysUntilEvent(row.event_end ?? row.event_start);
  if (days == null || days < 0) return null;
  if (row.outstanding_pct >= 40 && days <= 7) {
    return `Event in ${days} day${days === 1 ? "" : "s"} — ${row.outstanding_pct}% of performance obligations still outstanding`;
  }
  if (row.pending_exceptions > 0 && days <= 5) {
    return `Event in ${days} day${days === 1 ? "" : "s"} — ${row.pending_exceptions} exception(s) awaiting approval`;
  }
  return null;
}

function AssignmentFooter({
  linked,
}: {
  linked: (WorkAssignment & { assignee_name: string | null })[];
}) {
  if (linked.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)]">
        No crew assignments yet — assignments are the execution steps under this
        performance obligation.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Assignments (execution under this PO)
      </p>
      <ul className="space-y-2">
        {linked.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
          >
            <div>
              <Link
                href={`/work/assignments/${a.id}`}
                className="font-medium text-[var(--accent)] hover:underline"
              >
                {a.title}
              </Link>
              <p className="text-xs text-[var(--muted)]">
                {a.assignee_name ?? "Unassigned"}
                {a.scheduled_start
                  ? ` · ${new Date(a.scheduled_start).toLocaleString()}`
                  : ""}
              </p>
            </div>
            <StatusPill tone={statusTone(a.status)}>{a.status}</StatusPill>
          </li>
        ))}
      </ul>
    </div>
  );
}

function parseExceptionDisplay(ex: WorkExceptionRow): {
  scope: string;
  body: string;
} {
  const match = ex.description.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  if (match) {
    return { scope: match[1], body: match[2] || ex.description };
  }
  if (ex.assignment_title) {
    return { scope: ex.assignment_title, body: ex.description };
  }
  return { scope: EXCEPTION_SCOPE_CONTRACT, body: ex.description };
}

type SequenceRow = {
  obligation: ObligationWithResources;
  phase: DeliverablePhase;
  startMs: number;
  tie: number;
  displayNumber: number;
};

function earliestStart(
  ...candidates: (string | null | undefined)[]
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!Number.isNaN(t) && t < best) best = t;
  }
  return best;
}

export default async function WorkEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ focus?: string; exception?: string }>;
}) {
  const { contractId } = await params;
  const { focus, exception } = await searchParams;

  await ensureObligationsCoverDeliverables(contractId);

  const [
    status,
    deliverables,
    assignments,
    documents,
    obligations,
    parties,
    exceptions,
  ] = await Promise.all([
    getWorkEventStatus(contractId),
    listDeliverablesForContract(contractId),
    listAssignmentsForContract(contractId),
    listContractDocuments(contractId),
    listObligationsForContract(contractId),
    listActiveWorkParties(),
    listExceptions({ contractId }),
  ]);

  if (!status) notFound();

  const workAllowed = canStartWork(status.contract_status);
  const depositBlocked = status.contract_status === "deposit_pending";
  const hint = riskHint(status);
  const days = daysUntilEvent(status.event_end ?? status.event_start);
  const phases: DeliverablePhase[] = ["planning", "execution", "wrapup"];
  const byDeliverable = new Map<
    string,
    (WorkAssignment & { assignee_name: string | null })[]
  >();
  for (const a of assignments) {
    const list = byDeliverable.get(a.deliverable_id) ?? [];
    list.push(a);
    byDeliverable.set(a.deliverable_id, list);
  }
  const deliverableById = new Map(deliverables.map((d) => [d.id, d]));

  const focusObFilter = (o: ObligationWithResources) => {
    if (!focus) return true;
    if (focus === "completed") return o.status === "completed";
    if (focus === "outstanding")
      return o.status !== "completed" && o.status !== "waived";
    if (focus === "scheduled")
      return ["scheduled", "in_progress"].includes(o.status);
    return true;
  };

  const defaultCustomerContact = {
    name: `${status.customer_name} AP`,
    email:
      obligations.find((o) => o.customer_contact_email)
        ?.customer_contact_email ?? null,
  };

  const sequence: SequenceRow[] = obligations
    .filter(focusObFilter)
    .map((o) => {
      const linkedDel = o.deliverable_id
        ? deliverableById.get(o.deliverable_id)
        : undefined;
      const linkedAsg = o.deliverable_id
        ? byDeliverable.get(o.deliverable_id) ?? []
        : [];
      return {
        obligation: o,
        phase: o.phase,
        startMs: earliestStart(
          linkedDel?.scheduled_start,
          ...linkedAsg.map((a) => a.scheduled_start),
        ),
        tie: o.obligation_number || o.sort_order,
        displayNumber: 0,
      };
    });

  sequence.sort((a, b) => {
    const pr = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
    if (pr !== 0) return pr;
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    if (a.tie !== b.tie) return a.tie - b.tie;
    return a.obligation.title.localeCompare(b.obligation.title);
  });
  sequence.forEach((row, i) => {
    row.displayNumber = i + 1;
  });

  const byPhase = new Map<DeliverablePhase, SequenceRow[]>();
  for (const phase of phases) byPhase.set(phase, []);
  for (const row of sequence) byPhase.get(row.phase)!.push(row);

  const exceptionObligations = obligations.map((o) => {
    const linkedAssignments = o.deliverable_id
      ? byDeliverable.get(o.deliverable_id) ?? []
      : [];
    const openAssignment =
      linkedAssignments.find((a) => a.status !== "completed") ??
      linkedAssignments[0];
    return {
      id: o.id,
      obligationNumber: o.obligation_number,
      title: o.title,
      deliverableId: o.deliverable_id,
      assignmentId: openAssignment?.id ?? null,
    };
  });

  const pendingExceptions = exceptions.filter(
    (e) => e.status === "pending_approval" || e.status === "submitted",
  );
  const resolvedExceptions = exceptions.filter(
    (e) => e.status === "approved" || e.status === "rejected",
  );
  const exceptionStartNum = sequence.length + 1;

  return (
    <div>
      <EngagementHeaderWithException
        title={status.event_name}
        description={`${status.customer_name} · Track distinct performance obligations in completion order. Completion here is satisfaction evidence for ASC 606 (GAAP Compliance) and billing handoff — not the journal entry itself.`}
        contractId={contractId}
        defaultOpen={exception === "1" || exception === "true"}
        parties={parties.map((p) => ({
          id: p.id,
          display_name: p.display_name,
          party_type: p.party_type,
        }))}
        obligations={exceptionObligations}
      />

      {hint ? (
        <div className="mb-4 rounded-lg border border-[var(--warn)]/30 bg-[#fff7eb] px-4 py-3 text-sm text-[var(--warn)]">
          {hint}
        </div>
      ) : null}

      {!workAllowed ? (
        <div
          className="mb-4 rounded-lg border border-[var(--danger)]/35 bg-[#fef2f2] px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-semibold text-[var(--danger)]">
            {depositBlocked
              ? "Deposit required before work can start"
              : "Production locked"}
          </p>
          <p className="mt-1 text-[var(--ink)]">
            Contract status:{" "}
            <strong>
              {STATUS_LABELS[status.contract_status as ContractStatus] ??
                status.contract_status.replaceAll("_", " ")}
            </strong>
            . Check-in, completion, and time/materials are blocked until the
            engagement is <strong>Active</strong>
            {depositBlocked
              ? " (after the required customer deposit is recorded in Billing)."
              : "."}
          </p>
          {depositBlocked ? (
            <p className="mt-2">
              <Link
                href="/billing/deposits"
                className="font-semibold text-[var(--accent)] hover:underline"
              >
                Record deposit →
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm text-[var(--ink)]">
        <p className="font-semibold">ASC 606 story on this page</p>
        <p className="mt-1 text-[var(--muted)]">
          Each card is a <strong>performance obligation</strong> (promised good
          or service). Crew <strong>assignments</strong> sit under a PO as
          execution steps.{" "}
          <strong>Exceptions</strong> are contract changes / issues and always
          appear at the end until approved for Billing. Revenue recognition and
          contract asset/liability balances live in{" "}
          <Link href="/compliance" className="text-[var(--accent)] hover:underline">
            GAAP Compliance
          </Link>
          .
        </p>
      </div>

      {focus ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <StatusPill tone="accent">Filter: {focus}</StatusPill>
          <Link
            href={`/work/events/${contractId}`}
            className="text-[var(--accent)] hover:underline"
          >
            Clear filter
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={`/work/events/${contractId}?focus=outstanding`}>
          <StatCard
            label="Promised POs"
            value={String(status.promised_count)}
            hint="Click outstanding view"
          />
        </Link>
        <Link href={`/work/events/${contractId}?focus=scheduled`}>
          <StatCard
            label="Scheduled+"
            value={String(status.scheduled_count)}
            tone="accent"
            hint="Click to focus"
          />
        </Link>
        <Link href={`/work/events/${contractId}?focus=completed`}>
          <StatCard
            label="Satisfied / completed"
            value={String(status.completed_count)}
            hint="Click to focus"
          />
        </Link>
        <Link href={`/work/events/${contractId}?focus=outstanding`}>
          <StatCard
            label="Outstanding"
            value={String(status.outstanding_count)}
            hint={
              days == null
                ? undefined
                : days <= 0
                  ? "Event window"
                  : `${days}d to event end`
            }
            tone={status.outstanding_count > 0 ? "warn" : "default"}
          />
        </Link>
      </div>

      <div id="contract" className="mt-6 scroll-mt-8">
        <Panel
          title="Identify performance obligations"
          action={
            documents.length > 0 ? (
              <StatusPill tone="ok">Contract on file</StatusPill>
            ) : obligations.length > 0 ? (
              <StatusPill tone="accent">Manual / seeded</StatusPill>
            ) : (
              <StatusPill tone="warn">Not set up</StatusPill>
            )
          }
        >
          <p className="mb-3 text-sm text-[var(--muted)]">
            Attach the engagement agreement or answer guided questions. Extracted
            items become the numbered performance obligations below (ASC 606 Step
            2 — identify POs).
          </p>
          <ContractEntryPanel
            contractId={contractId}
            eventName={status.event_name}
            customerName={status.customer_name}
            documents={documents}
            parties={parties.map((p) => ({
              id: p.id,
              display_name: p.display_name,
              party_type: p.party_type,
            }))}
            defaultCustomerContact={defaultCustomerContact}
          />
        </Panel>
      </div>

      <div className="mt-6 space-y-4">
        {phases.map((phase) => {
          const meta = phaseMeta[phase];
          const rows = byPhase.get(phase) ?? [];

          if (rows.length === 0 && obligations.length > 0) return null;
          if (obligations.length === 0 && phase !== "planning") return null;

          return (
            <Panel
              key={phase}
              title={meta.title}
              action={
                meta.urgent ? (
                  <StatusPill tone="danger">Live day focus</StatusPill>
                ) : (
                  <span className="text-xs text-[var(--muted)]">{meta.hint}</span>
                )
              }
            >
              <div
                className={
                  meta.urgent
                    ? "rounded-md border border-[var(--danger)]/20 bg-[#fdf2f2]/50 p-3"
                    : undefined
                }
              >
                {rows.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No performance obligations in this phase yet — identify them
                    from the contract above.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {rows.map((row) => {
                      const linked = row.obligation.deliverable_id
                        ? byDeliverable.get(row.obligation.deliverable_id) ?? []
                        : [];
                      return (
                        <ObligationStatusCard
                          key={row.obligation.id}
                          obligation={row.obligation}
                          displayNumber={row.displayNumber}
                          footer={<AssignmentFooter linked={linked} />}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </Panel>
          );
        })}

        <Panel
          title="Exceptions (after all performance obligations)"
          action={
            <Link
              href="/work/exceptions"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Open exceptions inbox
            </Link>
          }
        >
          <p className="mb-3 text-sm text-[var(--muted)]">
            Scope changes, short shipments, and on-site problems are not separate
            PO types — they are exceptions to the contract/PO list. Approved items
            become <code className="text-xs">billable_eligible</code> for Billing;
            they do not post revenue here.
          </p>
          {exceptions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No exceptions yet. Use <strong>Report exception</strong> above when
              something goes wrong.
            </p>
          ) : (
            <ul className="space-y-3">
              {[...pendingExceptions, ...resolvedExceptions].map((ex, i) => {
                const { scope, body } = parseExceptionDisplay(ex);
                const num = exceptionStartNum + i;
                return (
                  <li
                    key={ex.id}
                    className="overflow-hidden rounded-lg border border-[var(--warn)]/30 bg-[#fff7eb]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--warn)]/20 px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-[var(--warn)] px-2 text-sm font-bold text-white">
                          #{num}
                        </span>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                            Exception · {scope}
                          </p>
                          <p className="font-semibold text-[var(--ink)]">
                            {TYPE_LABELS[ex.exception_type] ??
                              ex.exception_type}
                          </p>
                        </div>
                      </div>
                      <StatusPill tone={statusTone(ex.status)}>
                        {ex.status}
                      </StatusPill>
                    </div>
                    <div className="px-4 py-3 text-sm">
                      <p>{body}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        by {ex.submitter_name ?? "—"}
                        {ex.estimated_amount != null
                          ? ` · est. ${formatCurrency(ex.estimated_amount)}`
                          : ""}
                        {ex.billable_eligible ? " · billable eligible" : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
