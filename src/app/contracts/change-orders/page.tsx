import Link from "next/link";
import { listChangeOrders } from "@/features/contracts/queries";
import { formatDate, formatLabel } from "@/features/billing/aging";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function ChangeOrdersPage() {
  const rows = await listChangeOrders();

  return (
    <div>
      <PageHeader
        title="Change Orders"
        description="Commercial change requests. After Compliance applies an approved CO, contract value and change-order totals update and a payment-schedule line is added so Billing can invoice the delta without rewriting historical invoices."
      />
      <p className="mb-4 text-sm text-[var(--muted)]">
        Workflow: create/approve on the{" "}
        <Link href="/contracts/list" className="text-[var(--accent)] hover:underline">
          contract workspace
        </Link>
        , then apply on{" "}
        <Link
          href="/compliance/modifications"
          className="text-[var(--accent)] hover:underline"
        >
          Compliance → Modifications
        </Link>
        .
      </p>
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No change orders yet. Create them from a contract workspace.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">CO #</th>
                  <th className="pb-2 font-medium">Contract</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Price Δ</th>
                  <th className="pb-2 font-medium">Treatment</th>
                  <th className="pb-2 font-medium">Requested by</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Effective</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr
                    key={String(m.id)}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3 font-semibold">{String(m.mod_number)}</td>
                    <td className="py-3">
                      <Link
                        href={`/contracts/${m.contract_id}`}
                        className="text-[var(--accent)]"
                      >
                        {String(m.contract_number)}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">
                        {String(m.event_name)} · {String(m.customer_name)}
                      </div>
                    </td>
                    <td className="py-3 max-w-xs">
                      <div>{String(m.description)}</div>
                      {m.scope_change_notes ? (
                        <div className="text-xs text-[var(--muted)]">
                          Schedule/scope: {String(m.scope_change_notes)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <Money amount={Number(m.price_change)} />
                    </td>
                    <td className="py-3">
                      {formatLabel(String(m.accounting_treatment))}
                    </td>
                    <td className="py-3">
                      {String(m.requested_by ?? m.approved_by ?? "—")}
                    </td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          m.status === "applied"
                            ? "ok"
                            : m.status === "approved"
                              ? "accent"
                              : "warn"
                        }
                      >
                        {String(m.status)}
                      </StatusPill>
                    </td>
                    <td className="py-3">{formatDate(String(m.effective_date))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
