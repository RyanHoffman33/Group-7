"use client";

import Link from "next/link";
import { formatDate } from "@/features/billing/aging";
import { Money, Panel, StatusPill } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";
import type { CustomerMilestoneStatus } from "@/features/dashboard/customer-sample";

function MilestoneIcon({ status }: { status: CustomerMilestoneStatus }) {
  if (status === "complete") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e6f6ec] text-[#2f9a57]">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "action_needed") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#d97706] bg-[#fff7eb]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--line)] bg-white" />
  );
}

export function CustomerOverviewPage() {
  const {
    event,
    days,
    progress,
    financial,
    pendingCount,
    eventMilestones,
    eventDocs,
  } = useCustomerPortal();

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Pending approvals" value={String(pendingCount)} warn={pendingCount > 0} />
        <Stat
          label="Open balance"
          value={`$${financial.outstandingBalance.toLocaleString()}`}
          warn={financial.outstandingBalance > 0}
        />
        <Stat label="Days to event" value={String(days < 0 ? 0 : days)} />
        <Stat label="Documents" value={String(eventDocs.length)} />
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1.7fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.95fr)_1.1fr]">
            <div className="relative min-h-[160px] sm:min-h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.heroImage}
                alt={event.heroAlt}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
              <div className="absolute bottom-3 left-3 rounded bg-black/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white/95">
                {event.eventType}
              </div>
            </div>
            <div className="flex flex-col justify-between p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {event.status}
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-display)] text-[1.35rem] leading-snug text-[var(--ink)]">
                  {event.eventName}
                </h3>
                <ul className="mt-3 space-y-1.5 text-[13px] text-[var(--muted)]">
                  <li>{formatDate(event.eventDate)}</li>
                  <li className="truncate">{event.venue}</li>
                  <li>{event.guestCount} guests</li>
                </ul>
              </div>
              <Link
                href="/dashboard/customer/event"
                className="mt-4 inline-flex w-fit items-center rounded-md bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-white hover:opacity-95"
              >
                View event details
              </Link>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center">
          <p className="text-[12px] font-medium text-[var(--muted)]">Event countdown</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[3.25rem] leading-none text-[var(--accent)]">
            {days < 0 ? 0 : days}
          </p>
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            {days < 0 ? "Event completed" : days === 0 ? "Today!" : "Days to go"}
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        <Panel compact title="Planning progress" bodyClassName="px-3 py-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-[#e8eef3]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-[13px] font-semibold">{progress.percent}%</p>
          <p className="text-[12px] text-[var(--muted)]">
            {progress.completed} of {progress.total} milestones complete
            {progress.onTrack ? " · On track" : " · Needs attention"}
          </p>
        </Panel>

        <Panel compact title="Milestones" bodyClassName="px-3 py-1">
          <ul>
            {eventMilestones.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2.5 border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <MilestoneIcon status={m.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[12px] font-medium ${
                      m.status === "complete" ? "text-[var(--muted)]" : "text-[var(--ink)]"
                    }`}
                  >
                    {m.name}
                  </p>
                  <p
                    className={`text-[11px] ${
                      m.status === "action_needed"
                        ? "font-medium text-[#d97706]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    {m.dateLabel}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel compact title="Financial summary" bodyClassName="px-3 py-3">
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--muted)]">Contract total</dt>
              <dd className="font-semibold tabular-nums">
                <Money amount={financial.contractTotal} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--muted)]">Deposit (paid / billed)</dt>
              <dd className="font-semibold tabular-nums">
                <Money amount={financial.depositPaid} />
                <span className="font-normal text-[var(--muted)]">
                  {" "}
                  / <Money amount={financial.depositBilled} />
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--muted)]">Progress invoices remaining</dt>
              <dd className="font-semibold tabular-nums text-[#d97706]">
                <Money amount={financial.progressRemaining} />
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-[var(--line)] pt-2">
              <dt className="text-[var(--muted)]">Open balance</dt>
              <dd className="font-semibold tabular-nums text-[#d97706]">
                <Money amount={financial.outstandingBalance} />
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Deposits are held against your event until production milestones are
            billed. Status:{" "}
            <span className="font-medium text-[var(--ink)]">
              {financial.depositStatus === "satisfied"
                ? "Deposit satisfied"
                : financial.depositStatus === "partial"
                  ? "Deposit partially paid"
                  : financial.depositStatus === "due"
                    ? "Deposit due"
                    : "No deposit invoice"}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard/customer/invoices"
              className="inline-flex rounded-md bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-white hover:opacity-95"
            >
              View invoices
            </Link>
            <Link
              href="/dashboard/customer/actions"
              className="inline-flex rounded-md border border-[var(--line)] px-3 py-2 text-[12px] font-semibold hover:bg-[#f7f9fb]"
            >
              Action items
              {pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Link>
          </div>
        </Panel>
      </div>

      <Panel compact title="Your event contact" bodyClassName="px-3 py-3">
        <p className="text-[13px] font-semibold">{event.managerName}</p>
        <p className="text-[12px] text-[var(--muted)]">{event.managerRole}</p>
        <a
          href={`mailto:${event.managerEmail}`}
          className="mt-2 inline-block text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          {event.managerEmail}
        </a>
      </Panel>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          warn ? "text-[#d97706]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
