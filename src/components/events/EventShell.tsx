import { EventSubnav } from "@/components/dashboard";
import { EventSwitcher } from "@/components/events/EventSwitcher";
import { eventSubnavItems } from "@/features/events/seed";
import { getOpsEvent, listOpsEvents } from "@/features/events/queries";
import { notFound } from "next/navigation";

export async function EventShell({
  eventId,
  activeHref,
  children,
}: {
  eventId: string;
  activeHref: string;
  children: React.ReactNode;
}) {
  const event = await getOpsEvent(eventId);
  if (!event) notFound();
  const events = await listOpsEvents();

  return (
    <div>
      <div className="mb-5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
          Event Hub
        </p>
        <div className="mt-3">
          <EventSwitcher
            currentId={eventId}
            events={events.map((e) => ({
              id: e.id,
              name: e.name,
              customerName: e.customerName,
              status: e.status,
            }))}
          />
        </div>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          {event.name}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {event.venue} · {new Date(event.startAt).toLocaleString()} ·{" "}
          {event.status} · PM {event.projectManager}
        </p>
      </div>
      <EventSubnav
        eventId={eventId}
        items={eventSubnavItems}
        activeHref={activeHref}
      />
      {children}
    </div>
  );
}
