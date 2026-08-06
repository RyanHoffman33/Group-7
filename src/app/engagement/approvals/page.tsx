import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { InquiryApprovalCard } from "@/components/engagement/InternalEngagementClient";
import {
  countPendingApprovals,
  listNotifications,
  listPendingApprovalInquiries,
} from "@/features/engagement/queries";
import { roleHasPermission } from "@/features/access/matrix";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

export default async function EngagementApprovalsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (
    !roleHasPermission(session.roleKey, "contracts.write") &&
    !roleHasPermission(session.roleKey, "contracts.approve_co") &&
    session.roleKey !== "executive" &&
    session.roleKey !== "project_manager" &&
    session.roleKey !== "system_admin"
  ) {
    redirect("/access-denied");
  }

  const [queue, pendingCount, notifications] = await Promise.all([
    listPendingApprovalInquiries(),
    countPendingApprovals(),
    listNotifications("internal", 12),
  ]);

  return (
    <div>
      <PageHeader
        title="Inquiry approval queue"
        description="Executives and project managers approve customer inquiries only with a submitted company quote."
      />

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <StatusPill tone="warn">{pendingCount} pending approval</StatusPill>
        <Link
          href="/engagement/sourcing"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          Open Vendor Sourcing →
        </Link>
      </div>

      {notifications.length ? (
        <div className="mb-4">
          <Panel title="Engagement notifications">
            <ul className="space-y-2 text-sm">
              {notifications.map((n) => (
                <li key={n.id} className="rounded-md bg-[var(--bg)] px-3 py-2">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-[var(--muted)]">{n.body}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      <Panel title="Queue">
        {queue.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No inquiries awaiting approval or amendment.
          </p>
        ) : (
          <div className="space-y-4">
            {queue.map((inq) => (
              <InquiryApprovalCard key={inq.id} inquiry={inq} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
