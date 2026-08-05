import { EventShell } from "@/components/events/EventShell";
import { QrManagementClient } from "@/components/events/QrManagementClient";
import { PageHeader } from "@/components/billing/ui";
import { listQrCodes } from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function QrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const rows = await listQrCodes(id);
  const canManage = ["project_manager", "system_admin"].includes(session.roleKey);
  const canCheckIn = [
    "project_manager",
    "event_coordinator",
    "system_admin",
  ].includes(session.roleKey);

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/qr`}>
      <PageHeader
        title="QR codes & check-in"
        description="One active QR per registration. Payload encodes eventId|attendeeId|registrationId only. Duplicate check-ins require override."
      />
      <QrManagementClient
        eventId={id}
        actor={session.fullName}
        canManage={canManage}
        canCheckIn={canCheckIn}
        rows={rows.map((r) => ({
          id: r.id,
          registrationId: r.registrationId,
          attendeeName: r.attendeeName,
          registrationType: r.registrationType,
          registrationStatus: r.registrationStatus,
          status: r.status,
          payload: r.payload,
          checkIn: r.checkIn
            ? {
                checkedInAt: r.checkIn.checkedInAt,
                checkedInBy: r.checkIn.checkedInBy,
              }
            : undefined,
        }))}
      />
    </EventShell>
  );
}
