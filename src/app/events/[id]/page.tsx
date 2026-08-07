import Link from "next/link";
import { EventShell } from "@/components/events/EventShell";
import {
  DonutChart,
  FunnelChart,
  ProgressBar,
  SectionHeader,
} from "@/components/dashboard";
import { Panel, StatCard, StatusPill } from "@/components/billing/ui";
import {
  getOpsEvent,
  getRegistrationMetrics,
  listSpeakers,
} from "@/features/events/queries";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getOpsEvent(id);
  if (!event) notFound();
  const metrics = await getRegistrationMetrics(id);
  const speakerList = await listSpeakers(id);
  const f = metrics.funnel;

  return (
    <EventShell eventId={id} activeHref={`/events/${id}`}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Capacity" value={String(metrics.capacity)} hint={`${metrics.remaining} remaining`} />
        <StatCard label="Registrations" value={String(metrics.registrations)} tone="accent" />
        <StatCard label="Checked in" value={String(metrics.checkedIn)} />
        <StatCard label="Attendance rate" value={`${metrics.attendanceRate}%`} tone="warn" />
      </div>

      <div className="mt-4">
        <ProgressBar
          value={(metrics.registrations / Math.max(metrics.capacity, 1)) * 100}
          label="Registration fill"
          hint={`${metrics.registrations} / ${metrics.capacity}`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Registration types">
          <DonutChart
            centerLabel="Regs"
            centerValue={String(metrics.registrations)}
            segments={Object.entries(metrics.byType).map(([label, value], i) => ({
              label,
              value,
              color: ["#0b6e6e", "#1d4ed8", "#9a5b00", "#7c3aed", "#64748b"][i % 5],
            }))}
          />
        </Panel>
        <Panel title="Quick links">
          <ul className="space-y-2 text-sm">
            <li><Link className="text-[var(--accent)] hover:underline" href={`/events/${id}/features`}>Feature hub</Link></li>
            <li><Link className="text-[var(--accent)] hover:underline" href={`/events/${id}/schedule`}>Schedule</Link></li>
            <li><Link className="text-[var(--accent)] hover:underline" href={`/events/${id}/registration`}>Registration & attendance</Link></li>
            <li><Link className="text-[var(--accent)] hover:underline" href={`/events/${id}/qr`}>QR & check-in</Link></li>
            <li><Link className="text-[var(--accent)] hover:underline" href={`/events/${id}/emails`}>Email campaigns</Link></li>
            <li><Link className="text-[var(--accent)] hover:underline" href={`/events/${id}/speakers`}>Speakers ({speakerList.length})</Link></li>
            <li><Link className="text-[var(--accent)] hover:underline" href={`/events/${id}/agenda`}>Agenda</Link></li>
          </ul>
        </Panel>
      </div>

      <div className="mt-6">
        <SectionHeader title="Registration to attendance funnel" description="Operational funnel for this event (seed / demo counts)." />
        <Panel>
          <FunnelChart
            stages={[
              { title: "Invitations", count: f.invitationsSent, color: "#5b21b6" },
              { title: "Opened", count: f.invitationsOpened, pctLabel: "89% of sent", color: "#1e3a8a" },
              { title: "Website", count: f.websiteVisitors, pctLabel: "45% of opened", color: "#0369a1" },
              { title: "Reg visitors", count: f.registrationVisitors, pctLabel: "37% of visits", color: "#0f766e" },
              { title: "Registered", count: f.registrations, pctLabel: "48% of visitors", color: "#15803d" },
              { title: "Attendance", count: f.attendance, pctLabel: `${metrics.attendanceRate}% of regs`, color: "#b45309" },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill tone="warn">Waitlisted {metrics.waitlisted}</StatusPill>
        <StatusPill tone="danger">Canceled {metrics.canceled}</StatusPill>
        <StatusPill tone="neutral">No-shows {metrics.noShows}</StatusPill>
      </div>
    </EventShell>
  );
}
