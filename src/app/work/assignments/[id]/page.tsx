import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAssignmentDetail,
  listWorkParties,
} from "@/features/work/queries";
import {
  AttachmentUrlForm,
  CheckInButton,
  CompleteAssignmentForm,
  RaiseExceptionForm,
  TimeMaterialForm,
} from "@/components/work/Actions";
import {
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/billing/ui";
import { formatCurrency } from "@/features/billing/aging";

export const dynamic = "force-dynamic";

function statusTone(
  status: string,
): "neutral" | "ok" | "warn" | "danger" | "accent" {
  if (status === "completed") return "ok";
  if (status === "checked_in") return "accent";
  if (status === "blocked") return "danger";
  return "neutral";
}

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, parties] = await Promise.all([
    getAssignmentDetail(id),
    listWorkParties(),
  ]);
  if (!detail) notFound();

  const isExecution = detail.deliverable?.phase === "execution";
  const partyId = detail.assignee_party_id;

  return (
    <div>
      <PageHeader
        title={detail.title}
        description={`${detail.event_name ?? "Event"} · ${detail.customer_name ?? ""}`}
        actions={
          <Link
            href={`/work/events/${detail.contract_id}`}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            ← Event lifecycle
          </Link>
        }
      />

      {isExecution ? (
        <div className="mb-4 rounded-lg border border-[var(--warn)]/30 bg-[#fff7eb] px-4 py-3 text-sm text-[var(--warn)]">
          Live execution assignment — confirm arrival, document work, and escalate
          exceptions quickly.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Assignment">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Status</dt>
              <dd>
                <StatusPill tone={statusTone(detail.status)}>
                  {detail.status}
                </StatusPill>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Assignee</dt>
              <dd className="font-medium">
                {detail.assignee?.display_name ?? "—"}{" "}
                <span className="text-xs text-[var(--muted)]">
                  ({detail.assignee?.party_type})
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">When</dt>
              <dd className="text-right">
                {detail.scheduled_start
                  ? new Date(detail.scheduled_start).toLocaleString()
                  : "—"}
                {detail.scheduled_end
                  ? ` → ${new Date(detail.scheduled_end).toLocaleString()}`
                  : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Location</dt>
              <dd>{detail.location ?? "—"}</dd>
            </div>
            {detail.instructions ? (
              <div>
                <dt className="text-[var(--muted)]">Instructions</dt>
                <dd className="mt-1">{detail.instructions}</dd>
              </div>
            ) : null}
          </dl>
        </Panel>

        <Panel title="Contract / service requirements">
          {detail.deliverable ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Deliverable</dt>
                <dd className="mt-1 font-medium">
                  {detail.deliverable.title}{" "}
                  <span className="text-xs text-[var(--muted)]">
                    ({detail.deliverable.code})
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Phase</dt>
                <dd>{detail.deliverable.phase}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Deliverable status</dt>
                <dd>
                  <StatusPill tone={statusTone(detail.deliverable.status)}>
                    {detail.deliverable.status}
                  </StatusPill>
                </dd>
              </div>
              {detail.deliverable.description ? (
                <div>
                  <dt className="text-[var(--muted)]">Obligation</dt>
                  <dd className="mt-1">{detail.deliverable.description}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Deliverable missing — every assignment must link to a contract
              obligation.
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Arrival & completion">
          <div className="space-y-4">
            {detail.completion ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Checked in</dt>
                  <dd>
                    {detail.completion.checked_in_at
                      ? new Date(
                          detail.completion.checked_in_at,
                        ).toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Completed</dt>
                  <dd>
                    {detail.completion.completed_at
                      ? new Date(
                          detail.completion.completed_at,
                        ).toLocaleString()
                      : "In progress"}
                  </dd>
                </div>
                {detail.completion.completed_before_approval ? (
                  <StatusPill tone="warn">
                    Work before approval flagged
                  </StatusPill>
                ) : null}
                {detail.completion.work_notes ? (
                  <p className="rounded-md bg-[var(--bg)] p-3 text-sm">
                    {detail.completion.work_notes}
                  </p>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Not checked in yet.
              </p>
            )}

            {detail.status !== "completed" ? (
              <div className="flex flex-wrap gap-3 border-t border-[var(--line)] pt-4">
                {detail.status === "scheduled" || detail.status === "blocked" ? (
                  <CheckInButton assignmentId={detail.id} partyId={partyId} />
                ) : null}
              </div>
            ) : null}

            {detail.status === "checked_in" ||
            (detail.status !== "completed" && detail.completion?.checked_in_at) ? (
              <div className="border-t border-[var(--line)] pt-4">
                <CompleteAssignmentForm
                  assignmentId={detail.id}
                  partyId={partyId}
                />
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Time, materials & costs">
          <ul className="mb-4 space-y-2 text-sm">
            {detail.time_materials.map((t) => (
              <li
                key={t.id}
                className="flex justify-between gap-3 border-b border-[var(--line)] pb-2"
              >
                <span>
                  <span className="uppercase text-[10px] tracking-wider text-[var(--muted)]">
                    {t.entry_type}
                  </span>{" "}
                  {t.description}
                  {t.hours != null ? (
                    <span className="text-[var(--muted)]"> · {t.hours}h</span>
                  ) : null}
                </span>
                <span className="tabular-nums">
                  {formatCurrency(t.quantity * t.unit_cost)}
                </span>
              </li>
            ))}
            {detail.time_materials.length === 0 ? (
              <li className="text-[var(--muted)]">No entries yet.</li>
            ) : null}
          </ul>
          <TimeMaterialForm assignmentId={detail.id} partyId={partyId} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Supporting documentation">
          <ul className="mb-4 space-y-2 text-sm">
            {detail.attachments.map((a) => (
              <li key={a.id}>
                {a.external_url ? (
                  <a
                    href={a.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    {a.file_name}
                  </a>
                ) : (
                  a.file_name
                )}
              </li>
            ))}
            {detail.attachments.length === 0 ? (
              <li className="text-[var(--muted)]">No attachments yet.</li>
            ) : null}
          </ul>
          <AttachmentUrlForm assignmentId={detail.id} partyId={partyId} />
        </Panel>

        <Panel title="Report problem / ad hoc work">
          <p className="mb-3 text-xs text-[var(--muted)]">
            Unplanned work must be approved before it is treated as billable.
            Approval sets <code className="text-[11px]">billable_eligible</code>{" "}
            for Billing to pick up later.
          </p>
          {detail.exceptions.length > 0 ? (
            <ul className="mb-4 space-y-2 text-sm">
              {detail.exceptions.map((ex) => (
                <li
                  key={ex.id}
                  className="rounded-md border border-[var(--line)] p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      tone={
                        ex.status === "approved"
                          ? "ok"
                          : ex.status === "rejected"
                            ? "danger"
                            : "warn"
                      }
                    >
                      {ex.status}
                    </StatusPill>
                    {ex.billable_eligible ? (
                      <StatusPill tone="accent">billable_eligible</StatusPill>
                    ) : null}
                  </div>
                  <p className="mt-1">{ex.description}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <RaiseExceptionForm
            contractId={detail.contract_id}
            assignmentId={detail.id}
            parties={parties}
            defaultSubmitterId={partyId}
          />
        </Panel>
      </div>
    </div>
  );
}
