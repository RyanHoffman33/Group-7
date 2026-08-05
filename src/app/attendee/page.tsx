import Link from "next/link";
import { redirect } from "next/navigation";
import { QrPassCard } from "@/components/dashboard/QrPassCard";
import {
  AlertCard,
  ProgressBar,
  SectionHeader,
  SpeakerCard,
} from "@/components/dashboard";
import { PageHeader, Panel, StatusPill, StatCard } from "@/components/billing/ui";
import { PersonalScheduleToggle } from "@/components/events/PersonalScheduleToggle";
import { getAttendeePortal } from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

function countdown(startAt: string) {
  const ms = new Date(startAt).getTime() - Date.now();
  if (ms <= 0) return "Event day";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

export default async function AttendeePortalPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.roleKey !== "attendee" && session.roleKey !== "system_admin") {
    redirect("/home");
  }

  const portal = await getAttendeePortal(
    session.roleKey === "attendee" ? session.id : "usr-attendee",
  );
  if (!portal) {
    return (
      <div>
        <PageHeader title="My event" description="No registration found." />
        <AlertCard
          tone="warn"
          title="No registration"
          body="This attendee account is not linked to a registration in seed data."
        />
      </div>
    );
  }

  const {
    attendee,
    registration,
    event,
    qr,
    checkIn,
    sessions,
    mySessionIds,
    speakers,
    documents,
    announcements,
  } = portal;

  const progress =
    registration.status === "checked_in" || registration.status === "attended"
      ? 100
      : registration.status === "confirmed"
        ? 70
        : registration.status === "registered"
          ? 50
          : 25;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My upcoming event"
        description={`${attendee.fullName} · ${registration.registrationType} ticket`}
      />

      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              {event.name}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {new Date(event.startAt).toLocaleString()} –{" "}
              {new Date(event.endAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="mt-1 text-sm">{event.venue}</p>
            <p className="text-sm text-[var(--muted)]">{event.address}</p>
          </div>
          <div className="text-right">
            <StatusPill tone="accent">{registration.status}</StatusPill>
            <p className="mt-2 text-sm font-semibold text-[var(--accent)]">
              Countdown {countdown(event.startAt)}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={progress} label="Your registration progress" hint={`${progress}%`} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Check-in"
          value={checkIn ? "Complete" : "Not yet"}
          hint={checkIn ? new Date(checkIn.checkedInAt).toLocaleString() : "Bring your QR pass"}
          tone={checkIn ? "accent" : "warn"}
        />
        <StatCard
          label="Ticket type"
          value={registration.registrationType}
          hint="Assigned at registration"
        />
      </div>

      <div className="mt-6">
        <SectionHeader title="My QR check-in pass" />
        {qr ? (
          <QrPassCard
            payload={qr.payload}
            title={attendee.fullName}
            subtitle={attendee.organization}
            status={qr.status}
            eventName={event.name}
            venue={event.venue}
            when={new Date(event.startAt).toLocaleString()}
            ticketType={registration.registrationType}
          />
        ) : (
          <AlertCard
            tone="warn"
            title="No active QR"
            body="Your registration does not have an active check-in code."
          />
        )}
      </div>

      <div className="mt-6">
        <SectionHeader title="Today's agenda" description="Published sessions — add to your personal schedule." />
        <div className="space-y-3">
          {sessions.map((s) => (
            <Panel key={s.id} title={s.title}>
              <p className="text-sm text-[var(--muted)]">{s.description}</p>
              <p className="mt-2 text-sm">
                {new Date(s.startAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {s.room}
              </p>
              <div className="mt-3">
                <PersonalScheduleToggle
                  registrationId={registration.id}
                  sessionId={s.id}
                  selected={mySessionIds.has(s.id)}
                />
              </div>
            </Panel>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Featured speakers" />
        <div className="grid gap-3 sm:grid-cols-2">
          {speakers.map((s) => (
            <SpeakerCard
              key={s.id}
              name={s.name}
              title={s.title}
              organization={s.organization}
              publicOnly
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Important announcements" />
        <div className="space-y-2">
          {announcements.map((a) => (
            <AlertCard key={a.id} tone="info" title={a.title} body={a.body} />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel title="Event documents">
          <ul className="space-y-2 text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <span>{d.name}</span>
                <span className="text-[var(--muted)]">{d.kind}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Venue information">
          <p className="text-sm font-medium">{event.venue}</p>
          <p className="text-sm text-[var(--muted)]">{event.address}</p>
          <p className="mt-3 text-sm">
            Contact: {event.coordinator} (on-site coordinator)
          </p>
          <p className="mt-4 text-sm">
            <Link href="/attendee/survey" className="font-semibold text-[var(--accent)] hover:underline">
              Complete event survey →
            </Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}
