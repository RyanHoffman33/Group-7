import { EventShell } from "@/components/events/EventShell";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { listEventIssues } from "@/features/events/queries";

export const dynamic = "force-dynamic";

export default async function EventIssuesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const issues = await listEventIssues(id);

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/issues`}>
      <PageHeader
        title="Issues"
        description="On-site blockers and escalations for the coordinator / PM."
      />
      <div className="space-y-3">
        {issues.map((i) => (
          <Panel
            key={i.id}
            title={i.title}
            action={
              <StatusPill
                tone={
                  i.severity === "high"
                    ? "danger"
                    : i.severity === "medium"
                      ? "warn"
                      : "neutral"
                }
              >
                {i.severity} · {i.status}
              </StatusPill>
            }
          >
            <p className="text-sm text-[var(--muted)]">Reported by {i.reportedBy}</p>
          </Panel>
        ))}
      </div>
    </EventShell>
  );
}
