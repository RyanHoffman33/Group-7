import { listUsersWithRoles } from "@/features/users/queries";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

function statusTone(status: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "active") return "ok";
  if (status === "invited") return "warn";
  if (status === "disabled") return "danger";
  return "neutral";
}

export default async function UsersDirectoryPage() {
  const directory = await listUsersWithRoles();

  return (
    <div>
      <PageHeader
        title="User directory"
        description="Internal staff, customers, and vendors. Fake seed emails only — no real credentials."
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {directory.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">{u.fullName}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{u.email}</td>
                  <td className="px-4 py-3">{u.roleName}</td>
                  <td className="px-4 py-3">{u.organization}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={statusTone(u.status)}>{u.status}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
