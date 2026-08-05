import { getPermissionMatrix } from "@/features/users/queries";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const matrix = await getPermissionMatrix();

  return (
    <div>
      <PageHeader
        title="Role templates"
        description="Seven application roles aligned to the contract-to-cash workflow. Permissions are capability keys your RLS policies can enforce later."
      />
      <div className="grid gap-4">
        {matrix.map((role) => (
          <Panel
            key={role.id}
            title={role.name}
            action={
              <StatusPill tone="accent">{role.key}</StatusPill>
            }
          >
            <p className="mb-3 text-sm text-[var(--muted)]">{role.description}</p>
            <div className="flex flex-wrap gap-2">
              {role.permissionLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-[#eef2f6] px-2.5 py-1 text-xs text-[var(--ink)]"
                >
                  {label}
                </span>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
