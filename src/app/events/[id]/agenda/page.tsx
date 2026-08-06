import { EventShell } from "@/components/events/EventShell";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { listSessions, listSpeakers } from "@/features/events/queries";
import { speakerReadiness } from "@/features/events/types";

export const dynamic = "force-dynamic";

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sessionList, speakerList] = await Promise.all([
    listSessions(id),
    listSpeakers(id),
  ]);
  const byId = new Map(speakerList.map((s) => [s.id, s]));
  const sorted = [...sessionList].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  );

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/agenda`}>
      <PageHeader
        title="Agenda & sessions"
        description="Timeline by room. Speaker readiness shown for staff planning."
      />
      {sorted.length === 0 ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No agenda sessions for this event yet.
        </p>
      ) : (
        <>
      <div className="mb-4 overflow-x-auto">
        <div className="flex min-w-max gap-3">
          {sorted.map((s) => (
            <div
              key={`chip-${s.id}`}
              className="w-48 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3"
            >
              <p className="text-[10px] uppercase text-[var(--muted)]">{s.room}</p>
              <p className="mt-1 text-sm font-semibold leading-snug">{s.title}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {new Date(s.startAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {sorted.map((s) => (
          <Panel
            key={s.id}
            title={s.title}
            action={<StatusPill tone="accent">{s.status}</StatusPill>}
          >
            <p className="text-sm text-[var(--muted)]">{s.description}</p>
            <p className="mt-2 text-sm">
              {new Date(s.startAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              –{" "}
              {new Date(s.endAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {s.room} · Cap {s.capacity}
              {s.category ? ` · ${s.category}` : ""}
            </p>
            {s.speakerIds.length ? (
              <ul className="mt-2 space-y-1 text-xs">
                {s.speakerIds.map((sid) => {
                  const sp = byId.get(sid);
                  if (!sp) return null;
                  const ready = speakerReadiness(sp);
                  return (
                    <li key={sid} className="flex flex-wrap items-center gap-2">
                      <span className="text-[var(--accent)]">{sp.name}</span>
                      <StatusPill
                        tone={
                          ready.pct === 100
                            ? "ok"
                            : ready.pct >= 50
                              ? "warn"
                              : "danger"
                        }
                      >
                        {ready.pct}% ready
                      </StatusPill>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Panel>
        ))}
      </div>
        </>
      )}
    </EventShell>
  );
}
