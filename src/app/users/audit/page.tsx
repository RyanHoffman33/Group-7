import { listAccessAudit } from "@/features/users/queries";
import { PageHeader, Panel } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function UsersAuditPage() {
  const audit = await listAccessAudit();

  return (
    <div>
      <PageHeader
        title="Access audit trail"
        description="Placeholder history for role changes and access events. Wire to an append-only table when Auth goes live."
      />
      <Panel>
        <ul className="divide-y divide-[var(--line)]">
          {audit.map((row) => (
            <li key={row.id} className="px-4 py-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-[var(--ink)]">
                  {row.action} → {row.target}
                </p>
                <time className="text-xs text-[var(--muted)]">
                  {new Date(row.at).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-[var(--muted)]">
                {row.actor}: {row.detail}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
