import { EventShell } from "@/components/events/EventShell";
import { EventCalendarClient } from "@/components/events/EventCalendarClient";
import { PageHeader } from "@/components/billing/ui";
import { listCalendarItems } from "@/features/events/queries";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const items = await listCalendarItems(id);

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/schedule`}>
      <PageHeader
        title="Schedule"
        description="Operational calendar for setup, sessions, vendors, emails, and tasks."
      />
      <EventCalendarClient items={items} />
    </EventShell>
  );
}
