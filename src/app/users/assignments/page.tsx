import {
  listAssignments,
  listRoles,
  listUsers,
} from "@/features/users/queries";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const [assignments, users, roles] = await Promise.all([
    listAssignments(),
    listUsers(),
    listRoles(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const roleByKey = new Map(roles.map((r) => [r.key, r]));

  return (
    <div>
      <PageHeader
        title="Role assignments"
        description="Who holds which role. In production an administrator assigns roles — users do not self-select permissions."
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Assigned by</th>
                <th className="px-4 py-3 font-medium">Assigned at</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {assignments.map((a) => {
                const user = userById.get(a.userId);
                const role = roleByKey.get(a.roleKey);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium">
                      {user?.fullName ?? a.userId}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone="accent">
                        {role?.name ?? a.roleKey}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3">{a.assignedBy}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {a.assignedAt}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {a.note ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
