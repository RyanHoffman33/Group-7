import Link from "next/link";
import { formatCurrency, formatDate } from "@/features/billing/aging";
import {
  SAMPLE_ACTION_ITEMS,
  SAMPLE_ACTIVE_EVENT_ID,
  SAMPLE_CUSTOMER,
  SAMPLE_CUSTOMER_EVENTS,
  SAMPLE_DOCUMENTS,
  SAMPLE_FINANCIAL,
  SAMPLE_INVOICES,
  SAMPLE_MILESTONES,
  SAMPLE_PAYMENTS,
  daysUntil,
  planningProgressFromMilestones,
  type CustomerInvoiceStatus,
  type CustomerMilestoneStatus,
} from "@/features/dashboard/customer-sample";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

function ViewLink({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="text-[12px] font-medium text-[var(--accent)] hover:underline"
    >
      {label}
    </Link>
  );
}

function IconCal() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconGuests() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 19a5 5 0 0 1 5.5-4.8" strokeLinecap="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#d97706]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5h.01" strokeLinecap="round" />
    </svg>
  );
}

function MilestoneIcon({ status }: { status: CustomerMilestoneStatus }) {
  if (status === "complete") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e6f6ec] text-[#2f9a57]" aria-label="Complete">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "action_needed") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#d97706] bg-[#fff7eb]" aria-label="Action needed">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" />
      </span>
    );
  }
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--line)] bg-white"
      aria-label="Upcoming"
    />
  );
}

function invoiceTone(
  status: CustomerInvoiceStatus,
): "ok" | "warn" | "danger" | "neutral" | "accent" {
  if (status === "paid") return "ok";
  if (status === "overdue" || status === "disputed") return "danger";
  if (status === "partially_paid" || status === "unpaid") return "warn";
  return "neutral";
}

function invoiceLabel(status: CustomerInvoiceStatus): string {
  if (status === "partially_paid") return "Partial";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function CustomerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ event?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const selectedId =
    SAMPLE_CUSTOMER_EVENTS.find((e) => e.id === params.event)?.id ??
    SAMPLE_ACTIVE_EVENT_ID;
  const event =
    SAMPLE_CUSTOMER_EVENTS.find((e) => e.id === selectedId) ??
    SAMPLE_CUSTOMER_EVENTS[0];

  const today = new Date();
  const days = daysUntil(event.eventDate, today);
  const progress = planningProgressFromMilestones(SAMPLE_MILESTONES, today);

  const org = SAMPLE_CUSTOMER.organizationName;
  const first = SAMPLE_CUSTOMER.firstName;
  const greeting = first
    ? `Welcome, ${first}!`
    : org
      ? `Welcome, ${org}!`
      : "Welcome to your event portal.";

  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PageHeader
          compact
          title="Your Event Dashboard"
          description={`${greeting} Here's the latest on your event.`}
        />
      </div>

      {/* Event selector — only this customer's sample events */}
      {SAMPLE_CUSTOMER_EVENTS.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_CUSTOMER_EVENTS.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/customer?event=${e.id}`}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
                e.id === selectedId
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[#f7f9fb]"
              }`}
            >
              {e.eventName}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Row 1: Event summary | Countdown */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1.7fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
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
                  <li className="flex items-center gap-2">
                    <IconCal />
                    {formatDate(event.eventDate)}
                  </li>
                  <li className="flex items-center gap-2">
                    <IconPin />
                    <span className="truncate">{event.venue}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <IconGuests />
                    {event.guestCount} Guests
                  </li>
                </ul>
              </div>
              <Link
                href={event.href}
                className="mt-4 inline-flex w-fit items-center rounded-md bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-white hover:opacity-95"
              >
                View Event Details
              </Link>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
          <p className="text-[12px] font-medium text-[var(--muted)]">Event Countdown</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[3.25rem] leading-none text-[var(--accent)]">
            {days < 0 ? 0 : days}
          </p>
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            {days < 0 ? "Event completed" : days === 0 ? "Today!" : "Days to go!"}
          </p>
        </section>
      </div>

      {/* Row 2: Progress | Milestones | Financial */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        <Panel compact title="Planning Progress" bodyClassName="px-3 py-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-[#e8eef3]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${progress.percent}%` }}
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Planning progress"
            />
          </div>
          <p className="mt-2 text-[13px] font-semibold text-[var(--ink)]">
            {progress.percent}%
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {progress.completed} of {progress.total} milestones complete
            {progress.onTrack ? " · On track" : " · Needs attention"}
          </p>
        </Panel>

        <Panel
          compact
          title="Upcoming Milestones"
          action={<ViewLink href="/compliance" />}
          bodyClassName="px-3 py-1"
        >
          <ul>
            {SAMPLE_MILESTONES.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2.5 border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <MilestoneIcon status={m.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[12px] font-medium ${
                      m.status === "complete"
                        ? "text-[var(--muted)]"
                        : "text-[var(--ink)]"
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

        <Panel compact title="Financial Summary" bodyClassName="px-3 py-3">
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--muted)]">Contract Total</dt>
              <dd className="font-semibold tabular-nums">
                <Money amount={SAMPLE_FINANCIAL.contractTotal} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--muted)]">Paid to Date</dt>
              <dd className="font-semibold tabular-nums text-[#2f9a57]">
                <Money amount={SAMPLE_FINANCIAL.amountPaid} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--muted)]">Remaining Balance</dt>
              <dd className="font-semibold tabular-nums text-[#d97706]">
                <Money amount={SAMPLE_FINANCIAL.outstandingBalance} />
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-[var(--line)] pt-2">
              <dt className="text-[var(--muted)]">Next payment due</dt>
              <dd className="text-right text-[12px]">
                <span className="font-semibold tabular-nums">
                  <Money amount={SAMPLE_FINANCIAL.nextPaymentAmount} />
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                  {formatDate(SAMPLE_FINANCIAL.nextPaymentDue)}
                </span>
              </dd>
            </div>
          </dl>
          <Link
            href={SAMPLE_FINANCIAL.paymentCtaHref}
            className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-white hover:opacity-95"
          >
            {SAMPLE_FINANCIAL.paymentCtaLabel}
          </Link>
          <p className="mt-2 text-[10px] text-[var(--muted)]">
            Payments are recorded in the project ledger (simulated recording).
          </p>
        </Panel>
      </div>

      {/* Row 3: Action items | Invoices */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <Panel
          compact
          title="Your Action Items"
          bodyClassName="px-3 py-1"
        >
          {SAMPLE_ACTION_ITEMS.length === 0 ? (
            <p className="py-3 text-[13px] text-[var(--muted)]">
              Nothing needs your attention right now.
            </p>
          ) : (
            <ul>
              {SAMPLE_ACTION_ITEMS.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2.5 border-b border-[var(--line)] py-2.5 last:border-0"
                >
                  <IconAlert />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)]">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      {a.eventName} · Due {formatDate(a.dueDate)}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      {a.explanation}
                    </p>
                    <Link
                      href={a.href}
                      className="mt-2 inline-flex rounded-md border border-[var(--line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--ink)] hover:bg-[#f7f9fb]"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          compact
          title="Recent Invoices"
          action={<ViewLink href="/billing/invoices" />}
          bodyClassName="overflow-x-auto px-0 py-0"
        >
          <table className="w-full min-w-[480px] text-left text-[12px]">
            <thead className="border-b border-[var(--line)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_INVOICES.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={inv.href}
                      className="font-semibold text-[var(--accent)] hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-[11px] text-[var(--muted)]">{inv.description}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--muted)]">
                    {formatDate(inv.issueDate)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    <Money amount={inv.amount} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill compact tone={invoiceTone(inv.status)}>
                      {invoiceLabel(inv.status)}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Row 4: Payments | Documents | Contact */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        <Panel
          compact
          title="Recent Payments"
          action={<ViewLink href="/billing/payments" />}
          bodyClassName="px-3 py-1"
        >
          {SAMPLE_PAYMENTS.length === 0 ? (
            <p className="py-3 text-[13px] text-[var(--muted)]">No payments recorded yet.</p>
          ) : (
            <ul>
              {SAMPLE_PAYMENTS.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-2 border-b border-[var(--line)] py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium">{p.invoiceOrEvent}</p>
                    <p className="text-[11px] text-[var(--muted)]">
                      {formatDate(p.paidAt)} · {p.reference}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#2f9a57]">
                    <Money amount={p.amount} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel compact title="Documents" bodyClassName="px-3 py-1">
          <ul>
            {SAMPLE_DOCUMENTS.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{d.name}</p>
                  <p className="text-[11px] text-[var(--muted)]">{d.kind}</p>
                </div>
                <ViewLink href={d.href} label="Open" />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-[var(--muted)]">
            Sample customer-safe documents only.
          </p>
        </Panel>

        <Panel compact title="Your Event Contact" bodyClassName="px-3 py-3">
          <p className="text-[13px] font-semibold text-[var(--ink)]">
            {event.managerName}
          </p>
          <p className="text-[12px] text-[var(--muted)]">{event.managerRole}</p>
          <a
            href={`mailto:${event.managerEmail}`}
            className="mt-2 inline-block text-[12px] font-medium text-[var(--accent)] hover:underline"
          >
            {event.managerEmail}
          </a>
          <p className="mt-3 text-[11px] text-[var(--muted)]">
            Prefer email for now — in-app messaging is not available in this build.
          </p>
        </Panel>
      </div>
    </div>
  );
}
