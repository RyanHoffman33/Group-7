import { EventShell } from "@/components/events/EventShell";
import { DonutChart, FunnelChart, SectionHeader } from "@/components/dashboard";
import { Panel, StatCard } from "@/components/billing/ui";
import { getRegistrationMetrics } from "@/features/events/queries";

export const dynamic = "force-dynamic";

export default async function RegistrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const metrics = await getRegistrationMetrics(id);
  const f = metrics.funnel;

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/registration`}>
      <SectionHeader
        title="Registration & attendance"
        description="Visual summary inspired by enterprise event analytics — MainEvent branding."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invitations" value={metrics.totalInvitations.toLocaleString()} />
        <StatCard label="Registrations" value={String(metrics.registrations)} tone="accent" />
        <StatCard label="Checked in" value={String(metrics.checkedIn)} />
        <StatCard label="Attendance rate" value={`${metrics.attendanceRate}%`} hint={`${metrics.remaining} seats left`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Registration types">
          <DonutChart
            segments={Object.entries(metrics.byType).map(([label, value], i) => ({
              label,
              value,
              color: ["#0b6e6e", "#1d4ed8", "#9a5b00", "#7c3aed", "#64748b"][i % 5],
            }))}
          />
        </Panel>
        <Panel title="Contact / status mix">
          <DonutChart
            segments={Object.entries(metrics.byStatus).map(([label, value], i) => ({
              label,
              value,
              color: ["#0b6e6e", "#ca8a04", "#b91c1c", "#1d4ed8", "#64748b", "#7c3aed"][i % 6],
            }))}
          />
        </Panel>
        <Panel title="Registration sources">
          <DonutChart
            segments={Object.entries(metrics.bySource).map(([label, value], i) => ({
              label,
              value,
              color: ["#0b6e6e", "#0369a1", "#7c3aed", "#b45309"][i % 4],
            }))}
          />
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Conversion funnel">
          <FunnelChart
            stages={[
              { title: "Invited", count: f.invitationsSent, color: "#5b21b6" },
              { title: "Opened", count: f.invitationsOpened, color: "#1e3a8a" },
              { title: "Website", count: f.websiteVisitors, color: "#0369a1" },
              { title: "Started", count: f.registrationVisitors, color: "#0f766e" },
              { title: "Registered", count: f.registrations, color: "#15803d" },
              { title: "Attended", count: f.attendance, color: "#b45309" },
            ]}
          />
        </Panel>
      </div>
    </EventShell>
  );
}
