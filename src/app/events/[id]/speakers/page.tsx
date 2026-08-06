import { EventShell } from "@/components/events/EventShell";
import { SpeakersClient } from "@/components/events/SpeakersClient";
import { PageHeader } from "@/components/billing/ui";
import { listSpeakers } from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";
import { roleHasAnyPermission } from "@/features/access/matrix";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SpeakersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const list = await listSpeakers(id);
  const isStaff =
    roleHasAnyPermission(session.roleKey, [
      "speakers.support",
      "speakers.manage",
    ]) ||
    [
      "project_manager",
      "event_coordinator",
      "system_admin",
      "executive",
      "department_manager",
    ].includes(session.roleKey);

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/speakers`}>
      <PageHeader title="Speakers" />
      {list.length === 0 ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No speakers assigned to this event yet.
        </p>
      ) : (
        <SpeakersClient speakers={list} isStaff={isStaff} />
      )}
    </EventShell>
  );
}
