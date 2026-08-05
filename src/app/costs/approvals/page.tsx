import Link from "next/link";
import { formatDate } from "@/features/billing/aging";
import { APPROVAL_THRESHOLD, categoryLabel } from "@/features/costs/config";
import { listPendingApprovals } from "@/features/costs/queries";
import { ApprovalActions } from "@/components/costs/Actions";
import { CostFlagPills } from "@/components/costs/CostFlagsBanner";
import {
  Money,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const rows = await listPendingApprovals();

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        description={`Costs at or above $${APPROVAL_THRESHOLD.toLocaleString()} wait here until a manager approves or rejects.`}
      />

      <Panel title="Pending approval">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Event / customer</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Entered by</th>
                <th className="pb-2 font-medium">Flags</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[var(--line)] last:border-0"
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
                  <td className="py-3 text-[var(--muted)]">{e.entered_by}</td>
                  <td className="py-3">
                    <CostFlagPills entry={e} />
                  </td>
                  <td className="py-3">
                    <ApprovalActions entryId={e.id} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-sm text-[var(--muted)]">
                    No costs pending approval.
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
