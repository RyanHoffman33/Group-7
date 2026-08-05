import { EventShell } from "@/components/events/EventShell";
import { EmailCampaignClient } from "@/components/events/EmailCampaignClient";
import { PageHeader } from "@/components/billing/ui";
import { listEmails } from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const campaigns = await listEmails(id);

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/emails`}>
      <PageHeader
        title="Email campaigns"
        description="Create, approve, schedule, and simulate sends. Simulated sends never leave the application."
      />
      <EmailCampaignClient
        eventId={id}
        campaigns={campaigns}
        actor={session.fullName}
        canManage={["project_manager", "system_admin"].includes(session.roleKey)}
        canDraft={[
          "project_manager",
          "event_coordinator",
          "system_admin",
        ].includes(session.roleKey)}
      />
    </EventShell>
  );
}
