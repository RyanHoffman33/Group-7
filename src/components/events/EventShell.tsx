import { EventSubnav } from "@/components/dashboard";
import { eventSubnavItems } from "@/features/events/seed";
import { getOpsEvent } from "@/features/events/queries";
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

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
          Event operations · {event.status}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          {event.name}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {event.venue} · {new Date(event.startAt).toLocaleString()} · PM{" "}
          {event.projectManager}
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
