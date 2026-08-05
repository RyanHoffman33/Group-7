import { EventShell } from "@/components/events/EventShell";
import { StatusPill, Panel, PageHeader } from "@/components/billing/ui";
import { getAttendee, listRegistrations } from "@/features/events/queries";

export const dynamic = "force-dynamic";

export default async function AttendeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const regs = await listRegistrations(id);

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/attendees`}>
      <PageHeader
        title="Attendees"
        description="Registration roster for this event. Private contact details for other attendees are not shown to the Attendee portal."
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Attendee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {regs.map((r) => {
                const a = getAttendee(r.attendeeId);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{a?.fullName}</div>
                      <div className="text-xs text-[var(--muted)]">{a?.organization}</div>
                    </td>
                    <td className="px-4 py-3">{r.registrationType}</td>
                    <td className="px-4 py-3">{r.source}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        tone={
                          r.status === "canceled" || r.status === "no_show"
                            ? "danger"
                            : r.status === "waitlisted"
                              ? "warn"
                              : r.status === "checked_in" || r.status === "attended"
                                ? "ok"
                                : "accent"
                        }
                      >
                        {r.status}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </EventShell>
  );
}
