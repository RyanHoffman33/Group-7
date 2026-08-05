import { getSessionUser } from "@/features/users/session";
import { redirect } from "next/navigation";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { ApprovalsClient } from "@/components/access/ApprovalsClient";
import { listApprovals } from "@/features/access/approvals-seed";
import { APPROVAL_THRESHOLDS } from "@/features/access/thresholds";
import { roleHasAnyPermission } from "@/features/access/matrix";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (
    !roleHasAnyPermission(session.roleKey, [
      "approvals.queue",
      "controls.approve",
      "expenses.approve",
      "exceptions.approve_major",
      "contracts.approve_co",
    ])
  ) {
    redirect("/access-denied?from=/approvals");
  }

  const items = listApprovals();

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        description="Independent review of expenses, discounts, write-offs, and change orders. Self-approval is blocked."
      />
      <div className="mb-4">
        <Panel title="Configurable demo thresholds">
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {APPROVAL_THRESHOLDS.slice(0, 6).map((t) => (
              <li key={t.id}>
                <StatusPill tone="neutral">{t.approverRole}</StatusPill>{" "}
                {t.label}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <ApprovalsClient
        items={items}
        actorUserId={session.id}
        actorRole={session.roleKey}
      />
    </div>
  );
}
