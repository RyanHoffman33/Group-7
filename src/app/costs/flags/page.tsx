import Link from "next/link";
import { formatDate } from "@/features/billing/aging";
import { categoryLabel } from "@/features/costs/config";
import { flagReasons } from "@/features/costs/flags";
import { listExceptionCosts } from "@/features/costs/queries";
import {
  Money,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function FlagsExceptionsPage() {
  const rows = await listExceptionCosts();

  return (
    <div>
      <PageHeader
        title="Flags & exceptions"
        description="Control exceptions only — commitment variance, no commitment on file, duplicate invoice, late entry, and budget flags. Amounts over the approval threshold appear under Approvals, not here."
      />

      <Panel title={`${rows.length} control(s) needing attention`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Event / customer</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Why flagged</th>
                <th className="pb-2 font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const reasons = flagReasons(e);
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">{formatDate(e.incurred_date)}</td>
                    <td className="py-3">
                      <p className="font-medium text-[var(--ink)]">
                        {e.event_name}
                      </p>
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
                    <td className="py-3">
                      <Link
                        href={`/costs/entries/${e.id}`}
                        className="text-sm font-semibold text-[var(--accent)]"
                      >
                        View cost →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-sm text-[var(--muted)]">
                    No flagged costs right now.
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
