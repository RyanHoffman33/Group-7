import { EventShell } from "@/components/events/EventShell";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { listEventTasks } from "@/features/events/queries";

export const dynamic = "force-dynamic";

export default async function EventTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tasks = await listEventTasks(id);

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/tasks`}>
      <PageHeader
        title="Tasks"
        description="Coordinator work items for this event. Overdue items block Ready gates in the demo."
      />
      <div className="space-y-3">
        {tasks.map((t) => (
          <Panel
            key={t.id}
            title={t.title}
            action={
              <StatusPill
                tone={
                  t.status === "overdue"
                    ? "danger"
                    : t.status === "done"
                      ? "ok"
                      : "warn"
                }
              >
                {t.status}
              </StatusPill>
            }
          >
            <p className="text-sm text-[var(--muted)]">
              Due {new Date(t.dueAt).toLocaleString()} · {t.assignee} · Priority{" "}
              {t.priority}
            </p>
          </Panel>
        ))}
      </div>
    </EventShell>
  );
}
