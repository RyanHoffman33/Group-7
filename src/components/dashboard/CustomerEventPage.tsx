"use client";

import { formatDate } from "@/features/billing/aging";
import { Panel } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";

export function CustomerEventPage() {
  const { event } = useCustomerPortal();

  return (
    <div className="flex flex-col gap-3">
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="relative h-48 w-full sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.heroImage}
            alt={event.heroAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
              {event.eventType} · {event.status}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white sm:text-3xl">
              {event.eventName}
            </h2>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-sm text-[var(--muted)]">{event.summary}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Date</dt>
              <dd className="font-medium">{formatDate(event.eventDate)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Guests</dt>
              <dd className="font-medium">{event.guestCount}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Venue</dt>
              <dd className="font-medium">{event.venue}</dd>
              <dd className="text-[13px] text-[var(--muted)]">{event.venueAddress}</dd>
            </div>
          </dl>
        </div>
      </section>

      <Panel title="Agenda" bodyClassName="px-4 py-3">
        <ul className="space-y-2 text-sm">
          {event.agenda.map((row) => (
            <li key={row.time} className="flex gap-3">
              <span className="w-20 shrink-0 font-medium tabular-nums text-[var(--muted)]">
                {row.time}
              </span>
              <span>{row.item}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Included in your package" bodyClassName="px-4 py-3">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          {event.inclusions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="Your event contact" bodyClassName="px-4 py-3">
        <p className="font-semibold">{event.managerName}</p>
        <p className="text-sm text-[var(--muted)]">{event.managerRole}</p>
        <a
          href={`mailto:${event.managerEmail}`}
          className="mt-2 block text-sm font-medium text-[var(--accent)] hover:underline"
        >
          {event.managerEmail}
        </a>
        <a
          href={`tel:${event.managerPhone.replace(/\D/g, "")}`}
          className="mt-1 block text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          {event.managerPhone}
        </a>
      </Panel>
    </div>
  );
}
