import Link from "next/link";
import { EventShell } from "@/components/events/EventShell";
import { FeatureCard, SectionHeader } from "@/components/dashboard";
import { PageHeader } from "@/components/billing/ui";
import { getOpsEvent } from "@/features/events/queries";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EventFeaturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getOpsEvent(id);
  if (!event) notFound();

  const cards = [
    { title: "Registration", description: "Funnel, types, attendance", href: `/events/${id}/registration` },
    { title: "Schedule", description: "Calendar month / week / day", href: `/events/${id}/schedule` },
    { title: "Tasks", description: "Coordinator work queue", href: `/events/${id}/tasks` },
    { title: "Attendees", description: "Roster and statuses", href: `/events/${id}/attendees` },
    { title: "QR & check-in", description: "Passes and door scan", href: `/events/${id}/qr` },
    { title: "Emails", description: "Composer and simulated send", href: `/events/${id}/emails` },
    { title: "Speakers", description: "Readiness checklists", href: `/events/${id}/speakers` },
    { title: "Agenda", description: "Sessions and rooms", href: `/events/${id}/agenda` },
    { title: "Documents", description: "Guides and compliance files", href: `/events/${id}/documents` },
    { title: "Issues", description: "On-site blockers", href: `/events/${id}/issues` },
    { title: "Time & expenses", description: "Labor and receipts (demo)", href: `/events/${id}/time-expenses` },
  ];

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/features`}>
      <PageHeader
        title="Event feature hub"
        description="Cvent-style module entry for this engagement. Seed-backed demo — not connected to shared Supabase."
      />
      <SectionHeader title="Modules" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <FeatureCard
            key={c.href}
            title={c.title}
            description={c.description}
            actionLabel="Open"
            href={c.href}
          />
        ))}
      </div>
      <p className="mt-6 text-sm text-[var(--muted)]">
        Overview metrics live on the{" "}
        <Link className="text-[var(--accent)] hover:underline" href={`/events/${id}`}>
          event overview
        </Link>
        .
      </p>
    </EventShell>
  );
}
