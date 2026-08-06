import Link from "next/link";
import { formatDate } from "@/features/billing/aging";
import { categoryLabel } from "@/features/costs/config";
import { flagReasons } from "@/features/costs/flags";
import { listExceptionCosts } from "@/features/costs/queries";
import { ResolveFlagsForm } from "@/components/costs/Actions";
import {
  Money,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function FlagsExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const showResolved = sp.view === "resolved";
  const [openRows, resolvedRows] = await Promise.all([
    listExceptionCosts({ status: "open" }),
    listExceptionCosts({ status: "resolved" }),
  ]);
  const rows = showResolved ? resolvedRows : openRows;

  return (
    <div>
      <PageHeader
        title="Flags & exceptions"
        description="Items that need a decision — commitment variance, missing commitment, duplicate invoice, late entry, or budget flags. Large amounts waiting for approval appear only in the Approval Queue."
        actions={
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/costs/flags"
              className={
                !showResolved
                  ? "font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--accent)]"
              }
            >
              Open ({openRows.length})
            </Link>
            <span className="text-[var(--line)]">|</span>
            <Link
              href="/costs/flags?view=resolved"
              className={
                showResolved
                  ? "font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--accent)]"
              }
            >
              Resolved ({resolvedRows.length})
            </Link>
          </div>
        }
      />

      <Panel
        title={
          showResolved
            ? `${rows.length} resolved flag(s)`
            : `${rows.length} ${rows.length === 1 ? "item needs" : "items need"} attention`
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Event / customer</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Why flagged</th>
                <th className="pb-2 font-medium">
                  {showResolved ? "Resolution" : "Resolve"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const reasons = flagReasons(e);
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--line)] last:border-0 align-top"
                  >
                    <td className="py-3">{formatDate(e.incurred_date)}</td>
                    <td className="py-3">
                      <Link
                        href={`/costs/entries/${e.id}`}
                        className="font-medium text-[var(--accent)]"
                      >
                        {e.event_name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        {e.customer_name}
                      </p>
                    </td>
                    <td className="py-3">
                      <StatusPill>{categoryLabel(e.category)}</StatusPill>
                    </td>
                    <td className="py-3">
                      <Money amount={e.amount} />
                    </td>
                    <td className="py-3">
                      <ul className="space-y-1.5">
                        {reasons.map((r) => (
                          <li key={r}>
                            <StatusPill
                              tone={
                                r.includes("No commitment") ||
                                r.includes("% over")
                                  ? "danger"
                                  : "warn"
                              }
                            >
                              {r}
                            </StatusPill>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-3 min-w-[220px]">
                      {showResolved ? (
                        <div className="text-xs text-[var(--muted)]">
                          <p>
                            by {e.flags_resolved_by ?? "—"}
                            {e.flags_resolved_at
                              ? ` · ${new Date(e.flags_resolved_at).toLocaleString()}`
                              : ""}
                          </p>
                          {e.flags_resolution_note ? (
                            <p className="mt-1">{e.flags_resolution_note}</p>
                          ) : null}
                        </div>
                      ) : (
                        <ResolveFlagsForm entryId={e.id} compact />
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-sm text-[var(--muted)]">
                    {showResolved
                      ? "No resolved flags yet."
                      : "No open flagged costs right now."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
