import Link from "next/link";
import {
  ApproveExceptionButton,
  RejectExceptionButton,
} from "@/components/work/Actions";
import {
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/billing/ui";
import { formatCurrency } from "@/features/billing/aging";
import { listExceptions } from "@/features/work/queries";
import {
  EXCEPTION_SCOPE_CONTRACT,
  type WorkExceptionRow,
} from "@/features/work/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  vendor_noshow: "Vendor no-show",
  scope_addition: "Scope addition",
  problem: "Problem / issue",
  other: "Other",
};

/** Parse `[scope]` prefix from raiseException descriptions. */
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

export default async function ExceptionsPage() {
  const [pending, decided] = await Promise.all([
    listExceptions({ status: "pending_approval" }),
    listExceptions(),
  ]);
  const history = decided.filter(
    (e) => e.status === "approved" || e.status === "rejected",
  );

  return (
    <div>
      <PageHeader
        title="Exceptions & ad hoc"
        description="Exceptions are changes or issues against the performance-obligation list — not separate PO types. Approve to set billable_eligible for Billing; revenue recognition stays in GAAP Compliance."
        actions={
          <Link
            href="/work"
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            ← Risk board
          </Link>
        }
      />

      <Panel title="Pending approval">
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No pending exceptions.</p>
        ) : (
          <ul className="space-y-4">
            {pending.map((ex) => {
              const { scope, body } = parseExceptionDisplay(ex);
              const isContractWide = scope === EXCEPTION_SCOPE_CONTRACT;
              return (
                <li
                  key={ex.id}
                  className="rounded-lg border border-[var(--warn)]/30 bg-[#fff7eb] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[var(--ink)]">
                          {ex.event_name}
                        </p>
                        <StatusPill
                          tone={isContractWide ? "warn" : "accent"}
                        >
                          {scope}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-sm">{body}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {TYPE_LABELS[ex.exception_type] ?? ex.exception_type}
                        {" · by "}
                        {ex.submitter_name}
                        {ex.estimated_amount != null
                          ? ` · est. ${formatCurrency(ex.estimated_amount)}`
                          : ""}
                      </p>
                      <Link
                        href={`/work/events/${ex.contract_id}#exceptions`}
                        className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline"
                      >
                        View engagement
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ApproveExceptionButton exceptionId={ex.id} />
                      <RejectExceptionButton exceptionId={ex.id} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="mt-4">
        <Panel title="Resolved (Billing handoff view)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="pb-2 pr-3 font-medium">Event</th>
                  <th className="pb-2 pr-3 font-medium">Scope</th>
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">Billable?</th>
                  <th className="pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.map((ex) => {
                  const { scope, body } = parseExceptionDisplay(ex);
                  return (
                    <tr
                      key={ex.id}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="py-3 pr-3">
                        <p className="font-medium">{ex.event_name}</p>
                        <p className="text-xs text-[var(--muted)] line-clamp-2">
                          {body}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-xs">{scope}</td>
                      <td className="py-3 pr-3">
                        {TYPE_LABELS[ex.exception_type] ?? ex.exception_type}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusPill
                          tone={
                            ex.status === "approved" ? "ok" : "danger"
                          }
                        >
                          {ex.status}
                        </StatusPill>
                      </td>
                      <td className="py-3 pr-3">
                        {ex.billable_eligible ? "Yes" : "No"}
                      </td>
                      <td className="py-3">
                        {ex.estimated_amount != null
                          ? formatCurrency(ex.estimated_amount)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-sm text-[var(--muted)]"
                    >
                      No resolved exceptions yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
