import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";
import { listEventRequestsForStaff } from "@/features/requests/actions";

export const dynamic = "force-dynamic";

export default async function ContractRequestsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!roleHasPermission(session.roleKey, "contracts.read")) {
    redirect("/access-denied?from=/contracts/requests");
  }
  const canWrite = roleHasPermission(session.roleKey, "contracts.write");
  const requests = await listEventRequestsForStaff();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Project Manager
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            Requests for performance
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Customer intake requests. Review details, build a package quote,
            return it to the customer, and open valuation when drafting.
          </p>
        </div>
        <Link
          href="/valuation"
          className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-medium"
        >
          Valuation tool
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Guests</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Quote</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  No customer requests yet. New submissions from{" "}
                  <code className="text-xs">/request</code> appear here.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)]/70">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--ink)]">
                      {r.eventName}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {r.eventType} · {r.preferredDate}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.organization}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {r.contactName} · {r.contactEmail}
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.estimatedGuests}</td>
                  <td className="px-4 py-3 capitalize">
                    {r.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    {r.quote
                      ? `$${r.quote.amount.toLocaleString()} (${r.quote.packageLabel})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite ? (
                      <Link
                        href={`/contracts/requests/${r.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        Open
                      </Link>
                    ) : (
                      <Link
                        href={`/contracts/requests/${r.id}`}
                        className="text-[var(--muted)]"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
