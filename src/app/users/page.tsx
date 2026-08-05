import Link from "next/link";
import {
  getDirectoryStats,
  listUsersWithRoles,
} from "@/features/users/queries";
import {
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

function statusTone(status: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "active") return "ok";
  if (status === "invited") return "warn";
  if (status === "disabled") return "danger";
  return "neutral";
}

export default async function UsersDashboardPage() {
  const stats = await getDirectoryStats();
  const directory = await listUsersWithRoles();

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Directory, role templates, and permission gates for MainEvent. Seed data only — swap the directory adapter when Supabase Auth and teammate modules are ready. Do not rename GAAP views when wiring RLS."
        actions={
          <Link
            href="/users/directory"
            className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
          >
            Open directory
          </Link>
        }
      />

      <div className="mb-4 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]">
        <strong className="font-semibold">Working alone for now.</strong> Billing
        &amp; Compliance stay available as the template shell. Users &amp; Roles
        uses local seed data so you can build without waiting on Contracts,
        Costs, or other inputs.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active users"
          value={String(stats.activeUsers)}
          hint={`${stats.totalUsers} total in directory`}
          tone="accent"
        />
        <StatCard
          label="Invited"
          value={String(stats.invitedUsers)}
          hint="Awaiting acceptance"
          tone="warn"
        />
        <StatCard
          label="Roles"
          value={String(stats.roleCount)}
          hint="Application role templates"
        />
        <StatCard
          label="Permissions"
          value={String(stats.permissionCount)}
          hint="Cross-module capability keys"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Quick links">
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/users/directory">
                User directory
              </Link>
            </li>
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/users/roles">
                Role templates
              </Link>
            </li>
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/users/permissions">
                Permission catalog
              </Link>
            </li>
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/users/assignments">
                Role assignments
              </Link>
            </li>
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/users/audit">
                Access audit trail
              </Link>
            </li>
          </ul>
        </Panel>

        <Panel title="Recent access activity">
          <ul className="space-y-3 text-sm">
            {stats.recentAudit.map((row) => (
              <li
                key={row.id}
                className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"
              >
                <p className="font-medium text-[var(--ink)]">
                  {row.action} · {row.target}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {row.actor} — {row.detail}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Directory preview">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Organization</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {directory.slice(0, 6).map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{u.fullName}</div>
                      <div className="text-xs text-[var(--muted)]">{u.email}</div>
                    </td>
                    <td className="px-3 py-2.5">{u.roleName}</td>
                    <td className="px-3 py-2.5">{u.organization}</td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={statusTone(u.status)}>{u.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
