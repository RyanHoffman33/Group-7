import Link from "next/link";
import { PageHeader, Panel, StatusPill, StatCard } from "@/components/billing/ui";
import { listOpsEvents, getRegistrationMetrics } from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EventsIndexPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const events = await listOpsEvents();

  const cards = await Promise.all(
    events.map(async (e) => ({
      event: e,
      metrics: await getRegistrationMetrics(e.id),
    })),
  );

  return (
    <div>
      <PageHeader
        title="Events"
        description="Operational event workspace for planning, registration, QR, emails, and speakers. Linked to contracts via contract_id in the proposed schema."
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active / upcoming" value={String(events.length)} tone="accent" />
        <StatCard
          label="Total registrations"
          value={String(cards.reduce((s, c) => s + c.metrics.registrations, 0))}
        />
        <StatCard
          label="Checked in"
          value={String(cards.reduce((s, c) => s + c.metrics.checkedIn, 0))}
        />
      </div>
      <div className="grid gap-4">
        {cards.map(({ event, metrics }) => (
          <Panel
            key={event.id}
            title={event.name}
            action={<StatusPill tone="accent">{event.status}</StatusPill>}
          >
            <p className="text-sm text-[var(--muted)]">
              {event.customerName} · {event.venue} ·{" "}
              {new Date(event.startAt).toLocaleString()}
            </p>
            <p className="mt-2 text-sm">
              Registrations {metrics.registrations} · Checked in {metrics.checkedIn} ·{" "}
              Fill {Math.round((metrics.registrations / metrics.capacity) * 100)}%
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link className="font-semibold text-[var(--accent)] hover:underline" href={`/events/${event.id}`}>
                Open event
              </Link>
              <Link className="text-[var(--accent)] hover:underline" href={`/events/${event.id}/qr`}>
                QR & check-in
              </Link>
              <Link className="text-[var(--accent)] hover:underline" href={`/events/${event.id}/emails`}>
                Emails
              </Link>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
