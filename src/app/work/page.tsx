import Link from "next/link";
import {
  daysUntilEvent,
  filterWorkEvents,
  listWorkEventStatuses,
  type WorkBoardFilter,
} from "@/features/work/queries";
import {
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

const FILTERS: { id: WorkBoardFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "outstanding", label: "Outstanding" },
  { id: "completed", label: "Completed" },
  { id: "at_risk", label: "At risk" },
  { id: "exceptions", label: "Exceptions" },
];

export default async function WorkDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const filter = (sp.filter || sp.status || "all") as WorkBoardFilter;
  const events = await listWorkEventStatuses();

  const atRisk = events.filter(
    (e) =>
      e.outstanding_pct >= 40 ||
      e.pending_exceptions > 0 ||
      e.contract_status === "deposit_pending",
  );
  const depositBlocked = events.filter(
    (e) => e.contract_status === "deposit_pending",
  ).length;
  const totalOutstanding = events.reduce(
    (s, e) => s + e.outstanding_count,
    0,
  );
  const totalCompleted = events.reduce((s, e) => s + e.completed_count, 0);
  const totalPending = events.reduce((s, e) => s + e.pending_exceptions, 0);

  let visible = filterWorkEvents(events, filter);
  if (filter === "no_contract") {
    visible = events.filter((e) => !e.has_contract);
  }

  return (
    <div>
      <PageHeader
        title="Work & Performance"
        description="Track promised, scheduled, completed, and outstanding deliverables for each engagement. Completion here supports billing readiness; recognition stays in Compliance."
        actions={
          <Link
            href="/work/exceptions"
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            Exceptions inbox
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Link href="/work?filter=all" className="block transition hover:opacity-90">
          <StatCard
            label="Events with work"
            value={String(events.length)}
            hint="Click to show all"
            tone={filter === "all" ? "accent" : "default"}
          />
        </Link>
        <Link
          href="/work?filter=outstanding"
          className="block transition hover:opacity-90"
        >
          <StatCard
            label="Outstanding"
            value={String(totalOutstanding)}
            hint="Click to filter outstanding"
            tone={
              filter === "outstanding"
                ? "accent"
                : totalOutstanding > 0
                  ? "warn"
                  : "default"
            }
          />
        </Link>
        <Link
          href="/work?filter=completed"
          className="block transition hover:opacity-90"
        >
          <StatCard
            label="Completed POs"
            value={String(totalCompleted)}
            hint="Click to filter fully done events"
            tone={filter === "completed" ? "accent" : "default"}
          />
        </Link>
        <Link
          href="/work?filter=at_risk"
          className="block transition hover:opacity-90"
        >
          <StatCard
            label="At-risk events"
            value={String(atRisk.length)}
            hint={
              depositBlocked > 0
                ? `${depositBlocked} waiting on deposit`
                : "≥40% outstanding, exceptions, or deposit hold"
            }
            tone={
              filter === "at_risk"
                ? "accent"
                : atRisk.length > 0
                  ? "danger"
                  : "default"
            }
          />
        </Link>
        <Link
          href="/work?filter=exceptions"
          className="block transition hover:opacity-90"
        >
          <StatCard
            label="Pending exceptions"
            value={String(totalPending)}
            hint="Click to filter"
            tone={
              filter === "exceptions"
                ? "accent"
                : totalPending > 0
                  ? "warn"
                  : "default"
            }
          />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/work?filter=${f.id}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === f.id
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--bg)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <Link
          href="/work?filter=no_contract"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            filter === "no_contract"
              ? "bg-[var(--accent)] text-white"
              : "border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--bg)]"
          }`}
        >
          No contract file ({events.filter((e) => !e.has_contract).length})
        </Link>
      </div>

      <div className="mt-6">
        <Panel
          title="Event risk board"
          action={
            <span className="text-xs text-[var(--muted)]">
              Showing {visible.length} of {events.length} · click a row
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="pb-2 pr-3 font-medium">Event</th>
                  <th className="pb-2 pr-3 font-medium">Contract</th>
                  <th className="pb-2 pr-3 font-medium">Timing</th>
                  <th className="pb-2 pr-3 font-medium">Promised</th>
                  <th className="pb-2 pr-3 font-medium">Scheduled</th>
                  <th className="pb-2 pr-3 font-medium">Completed</th>
                  <th className="pb-2 pr-3 font-medium">Outstanding</th>
                  <th className="pb-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const days = daysUntilEvent(e.event_start);
                  const risk =
                    e.outstanding_pct >= 40 && days != null && days <= 7;
                  return (
                    <tr
                      key={e.contract_id}
                      className="group border-b border-[var(--line)] last:border-0 hover:bg-[var(--accent-soft)]/40"
                    >
                      <td className="py-3 pr-3">
                        <Link
                          href={`/work/events/${e.contract_id}`}
                          className="block font-medium text-[var(--accent)] group-hover:underline"
                        >
                          {e.event_name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          {e.customer_name}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <Link href={`/work/events/${e.contract_id}#contract`}>
                          {e.has_contract ? (
                            <StatusPill tone="ok">
                              {e.ai_obligation_count
                                ? `AI · ${e.ai_obligation_count}`
                                : "On file"}
                            </StatusPill>
                          ) : e.manual_obligation_count ? (
                            <StatusPill tone="accent">
                              Manual · {e.manual_obligation_count}
                            </StatusPill>
                          ) : e.promised_count > 0 ? (
                            <StatusPill tone="accent">
                              {e.promised_count} items
                            </StatusPill>
                          ) : (
                            <StatusPill tone="warn">Add obligations</StatusPill>
                          )}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-[var(--muted)]">
                        <Link href={`/work/events/${e.contract_id}`}>
                          {days == null
                            ? "—"
                            : days < 0
                              ? `${Math.abs(days)}d past`
                              : days === 0
                                ? "Today"
                                : `In ${days}d`}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        <Link href={`/work/events/${e.contract_id}`}>
                          {e.promised_count}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        <Link
                          href={`/work/events/${e.contract_id}?focus=scheduled`}
                        >
                          {e.scheduled_count}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        <Link
                          href={`/work/events/${e.contract_id}?focus=completed`}
                          className="text-[var(--ok)] hover:underline"
                        >
                          {e.completed_count}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        <Link
                          href={`/work/events/${e.contract_id}?focus=outstanding`}
                          className="font-medium text-[var(--warn)] hover:underline"
                        >
                          {e.outstanding_count}{" "}
                          <span className="text-xs font-normal text-[var(--muted)]">
                            ({e.outstanding_pct}%)
                          </span>
                        </Link>
                      </td>
                      <td className="py-3">
                        <Link href={`/work/events/${e.contract_id}`}>
                          <div className="flex flex-wrap gap-1">
                            {e.contract_status === "deposit_pending" ? (
                              <StatusPill tone="danger">
                                Deposit required
                              </StatusPill>
                            ) : null}
                            {risk ? (
                              <StatusPill tone="danger">
                                {days != null && days <= 7
                                  ? `Event in ${days}d — ${e.outstanding_pct}% unconfirmed`
                                  : "High outstanding"}
                              </StatusPill>
                            ) : days != null && days < 0 ? (
                              <StatusPill tone="warn">
                                Past event date — review outstanding work
                              </StatusPill>
                            ) : e.pending_exceptions > 0 ? (
                              <StatusPill tone="warn">
                                {e.pending_exceptions} exception
                                {e.pending_exceptions === 1 ? "" : "s"}
                              </StatusPill>
                            ) : (
                              <StatusPill tone="ok">On track</StatusPill>
                            )}
                          </div>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      No events match this filter.{" "}
                      <Link
                        href="/work?filter=all"
                        className="text-[var(--accent)] hover:underline"
                      >
                        Show all
                      </Link>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
