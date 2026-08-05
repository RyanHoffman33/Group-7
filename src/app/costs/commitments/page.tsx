import Link from "next/link";
import { formatDate } from "@/features/billing/aging";
import { categoryLabel } from "@/features/costs/config";
import { listCommittedCosts } from "@/features/costs/queries";
import { ActualizeCostButton } from "@/components/costs/Actions";
import { CostFlagPills } from "@/components/costs/CostFlagsBanner";
import {
  Money,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function CommitmentsPage() {
  const rows = await listCommittedCosts();

  return (
    <div>
      <PageHeader
        title="Commitments"
        description="Costs contracted or booked but not yet actualized. Mark as actualized when the real invoice/cost is known."
      />

      <Panel title="Committed — not yet actualized">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="pb-2 font-medium">Date committed</th>
                <th className="pb-2 font-medium">Vendor / payee</th>
                <th className="pb-2 font-medium">Event</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Committed $</th>
                <th className="pb-2 font-medium">Flags</th>
                <th className="pb-2 font-medium">Action</th>
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
                      {e.vendor_name ?? e.worker_label ?? "—"}
                    </Link>
                    {e.invoice_ref ? (
                      <p className="text-xs text-[var(--muted)]">
                        {e.invoice_ref}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3">
                    <p>{e.event_name}</p>
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
                    <CostFlagPills entry={e} />
                  </td>
                  <td className="py-3">
                    <ActualizeCostButton
                      entryId={e.id}
                      committedAmount={e.amount}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-sm text-[var(--muted)]">
                    No open commitments.
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
