import Link from "next/link";
import { redirect } from "next/navigation";
import { listChangeOrders } from "@/features/contracts/queries";
import { formatDate, formatLabel } from "@/features/billing/aging";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";

export const dynamic = "force-dynamic";

/**
 * Unified commercial post-billing changes view (change orders).
 * Ops work exceptions stay under /work/exceptions with escalate links.
 */
export default async function ContractChangesPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!roleHasPermission(session.roleKey, "contracts.read")) {
    redirect("/access-denied?from=/contracts/changes");
  }

  const rows = await listChangeOrders();
  const canCompliance =
    roleHasPermission(session.roleKey, "compliance.read") ||
    roleHasPermission(session.roleKey, "recognition.read");

  return (
    <div>
      <PageHeader
        title="Contract Changes"
        description="Add or change contract commercial details after initial billing — scope, price, and schedule deltas via change orders. Operational field issues remain in the Ops Exception Inbox and can escalate here when price changes."
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link
          href="/contracts/list"
          className="text-[var(--accent)] hover:underline"
        >
          Open contract workspace
        </Link>
        <span className="text-[var(--muted)]">·</span>
        {canCompliance ? (
          <Link
            href="/compliance/modifications"
            className="text-[var(--accent)] hover:underline"
          >
            Apply in Compliance
          </Link>
        ) : (
          <span className="text-[var(--muted)]">
            Compliance apply (accounting / executive)
          </span>
        )}
        <span className="text-[var(--muted)]">·</span>
        <Link
          href="/work/exceptions"
          className="text-[var(--accent)] hover:underline"
        >
          Ops exceptions
        </Link>
        <span className="text-[var(--muted)]">·</span>
        <Link href="/valuation" className="text-[var(--accent)] hover:underline">
          Valuation tool
        </Link>
      </div>
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No contract changes yet. Create a draft change order from a contract
            workspace, or escalate a scope-addition ops exception.
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
                    <td className="py-3 font-semibold">
                      {String(m.mod_number)}
                    </td>
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
                      {formatLabel(String(m.accounting_treatment ?? "—"))}
                    </td>
                    <td className="py-3">{String(m.requested_by ?? "—")}</td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          m.status === "applied"
                            ? "ok"
                            : m.status === "approved"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {formatLabel(String(m.status))}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      {m.effective_date
                        ? formatDate(String(m.effective_date))
                        : "—"}
                    </td>
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
