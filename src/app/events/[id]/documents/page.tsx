import { EventShell } from "@/components/events/EventShell";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { listEventDocuments } from "@/features/events/queries";

export const dynamic = "force-dynamic";

export default async function EventDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const docs = await listEventDocuments(id);

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/documents`}>
      <PageHeader
        title="Documents"
        description="Public attendee files and internal/compliance packets. Upload is simulated."
      />
      <div className="space-y-3">
        {docs.map((d) => (
          <Panel
            key={d.id}
            title={d.name}
            action={
              <StatusPill tone={d.awaitingUpload ? "warn" : "ok"}>
                {d.awaitingUpload ? "Awaiting upload" : "On file"}
              </StatusPill>
            }
          >
            <p className="text-sm text-[var(--muted)]">
              {d.kind} · {d.publicToAttendee ? "Visible to attendees" : "Staff only"}
            </p>
          </Panel>
        ))}
      </div>
    </EventShell>
  );
}
