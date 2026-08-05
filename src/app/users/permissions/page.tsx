import { listPermissions } from "@/features/users/queries";
import { PageHeader, Panel } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  const permissions = await listPermissions();
  const byModule = permissions.reduce<Record<string, typeof permissions>>(
    (acc, p) => {
      (acc[p.module] ??= []).push(p);
      return acc;
    },
    {},
  );

  return (
    <div>
      <PageHeader
        title="Permission catalog"
        description="Cross-module capability keys. Teammate modules should call into these keys (or map to them) instead of inventing parallel permission strings."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(byModule).map(([module, rows]) => (
          <Panel key={module} title={module}>
            <ul className="space-y-3 text-sm">
              {rows.map((p) => (
                <li key={p.key} className="border-b border-[var(--line)] pb-3 last:border-0">
                  <p className="font-medium text-[var(--ink)]">{p.label}</p>
                  <p className="font-mono text-[11px] text-[var(--accent)]">{p.key}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{p.description}</p>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
