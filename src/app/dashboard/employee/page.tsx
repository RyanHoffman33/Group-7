import Link from "next/link";
import { formatDate } from "@/features/billing/aging";
import {
  SAMPLE_ASSIGNMENTS,
  SAMPLE_DOCUMENTS,
  SAMPLE_EMPLOYEE,
  SAMPLE_EXPENSES,
  SAMPLE_HOURS,
  SAMPLE_ISSUES,
  SAMPLE_NEXT_EVENT,
  SAMPLE_TASKS,
  SAMPLE_UPDATES,
  type EmployeeTaskStatus,
} from "@/features/dashboard/employee-sample";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

function ViewLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-[12px] font-medium text-[var(--accent)] hover:underline"
    >
      {label}
    </Link>
  );
}

function shortDue(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dueClass(status: EmployeeTaskStatus): string {
  if (status === "overdue" || status === "due_today") return "text-[var(--danger)]";
  if (status === "due_soon") return "text-[var(--warn)]";
  if (status === "completed") return "text-[var(--ok)]";
  return "text-[var(--muted)]";
}

function IconCal() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  );
}

function IconFeedback() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
      <path d="M8 9h8M8 12h5" strokeLinecap="round" />
    </svg>
  );
}

export default async function EmployeeDashboardPage() {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const monthShort = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const dayNum = now.getDate();
  const year = now.getFullYear();

  const greeting = SAMPLE_EMPLOYEE.firstName
    ? `Welcome back, ${SAMPLE_EMPLOYEE.firstName}!`
    : "Welcome back. Here's what you have coming up.";

  const next = SAMPLE_NEXT_EVENT;
  const hoursPct = Math.min(
    100,
    (SAMPLE_HOURS.totalHours / (SAMPLE_HOURS.targetHours ?? 40)) * 100,
  );

  const taskOrder = SAMPLE_TASKS.slice().sort((a, b) => {
    const rank = (s: EmployeeTaskStatus) =>
      s === "overdue" ? 0 : s === "due_today" ? 1 : s === "due_soon" ? 2 : s === "scheduled" ? 3 : 4;
    return rank(a.status) - rank(b.status) || a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col gap-2">
      <PageHeader
        compact
        title="Employee Dashboard"
        description={greeting}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/events/evt-ops-1/issues"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[#f7f9fb]"
              title="Request feedback"
            >
              <IconFeedback />
              Request feedback
            </Link>
            <Link
              href="/events/evt-ops-1/issues"
              className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[#f7f9fb]"
            >
              Report issue
            </Link>
          </div>
        }
      />

      {/* Row 1: My Day | My Tasks */}
      <div className="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,0.9fr)_1.4fr]">
        <section className="flex h-full flex-col rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            My Day
          </p>
          <div className="mt-2 flex flex-1 gap-3">
            <div className="flex w-[72px] shrink-0 flex-col items-center justify-center rounded-md border border-[var(--line)] bg-white px-2 py-2.5 text-center">
              <span className="text-[10px] font-semibold tracking-wide text-[var(--muted)]">
                {weekday.slice(0, 3)}
              </span>
              <span className="text-[10px] font-medium text-[var(--muted)]">
                {monthShort}
              </span>
              <span className="mt-0.5 font-[family-name:var(--font-display)] text-2xl leading-none text-[var(--ink)]">
                {dayNum}
              </span>
              <span className="mt-0.5 text-[10px] text-[var(--muted)]">{year}</span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Next Event
              </p>
              {next ? (
                <>
                  <Link
                    href={next.href}
                    className="mt-1 block font-[family-name:var(--font-display)] text-[1.15rem] leading-snug text-[var(--ink)] hover:text-[var(--accent)]"
                  >
                    {next.eventName}
                  </Link>
                  <p className="mt-2 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                    <IconCal />
                    <span>
                      {formatDate(next.eventDate)} · {next.startTime}
                    </span>
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                    <IconPin />
                    <span className="truncate">{next.venue}</span>
                  </p>
                  <p className="mt-2 text-[12px]">
                    <span className="text-[var(--muted)]">Role: </span>
                    <span className="font-medium">{next.role}</span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[12px] text-[var(--muted)]">
                  No upcoming event assigned.
                </p>
              )}
            </div>
          </div>
        </section>

        <Panel
          compact
          className="h-full"
          title="My Tasks"
          action={<ViewLink href="/events/evt-ops-1/tasks" label="View all" />}
          bodyClassName="px-3 py-1"
        >
          <ul>
            {taskOrder.map((task) => {
              const done = task.status === "completed";
              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 border-b border-[var(--line)] py-2 last:border-0"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      done
                        ? "border-[var(--ok)] bg-[var(--ok)] text-white"
                        : "border-[var(--line)] bg-white"
                    }`}
                    aria-hidden="true"
                    title={
                      done
                        ? "Completed"
                        : "Open task to complete via approved workflow"
                    }
                  >
                    {done ? (
                      <svg
                        viewBox="0 0 16 16"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          d="M3.5 8.5 6.5 11.5 12.5 4.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <Link href={task.href} className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[13px] font-medium ${
                        done ? "text-[var(--muted)] line-through" : "text-[var(--ink)]"
                      }`}
                    >
                      {task.name}
                    </p>
                    <p className="truncate text-[11px] text-[var(--muted)]">
                      {task.eventName}
                    </p>
                  </Link>
                  <span
                    className={`shrink-0 text-[12px] font-semibold ${dueClass(task.status)}`}
                  >
                    {done ? "Done" : `Due ${shortDue(task.dueDate)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* Row 2: Assignments | Hours | Messages */}
      <div className="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-3">
        <Panel
          compact
          className="h-full"
          title="Upcoming Assignments"
          action={<ViewLink href="/events/evt-ops-1/tasks" label="View all" />}
          bodyClassName="px-3 py-1"
        >
          <ul>
            {SAMPLE_ASSIGNMENTS.map((a) => (
              <li
                key={a.id}
                className="flex gap-3 border-b border-[var(--line)] py-2 last:border-0"
              >
                <div className="w-12 shrink-0 pt-0.5 text-[12px] font-semibold text-[var(--ink)]">
                  {shortDay(a.date)}
                </div>
                <Link href={a.href} className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                    {a.eventName}
                  </p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {a.detail}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          compact
          className="h-full"
          title="Hours This Week"
          action={
            <ViewLink href={SAMPLE_HOURS.enterTimeHref} label="View time entry" />
          }
          bodyClassName="flex flex-col justify-center px-3 py-2.5"
        >
          <p className="font-[family-name:var(--font-display)] text-[1.75rem] leading-none text-[var(--ink)]">
            {SAMPLE_HOURS.totalHours.toFixed(1)}
            <span className="text-[1rem] font-normal text-[var(--muted)]">
              {" "}
              / {SAMPLE_HOURS.targetHours ?? "—"}
            </span>
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">Hours Logged</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eef3]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${hoursPct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1 text-center">
            {SAMPLE_HOURS.byDay.map((d) => (
              <div key={d.label}>
                <p className="text-[10px] font-medium uppercase text-[var(--muted)]">
                  {d.label}
                </p>
                <p className="mt-1 text-[13px] font-semibold tabular-nums text-[var(--ink)]">
                  {d.hours.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          compact
          className="h-full"
          title="Messages / Updates"
          bodyClassName="px-3 py-1"
        >
          <ul>
            {SAMPLE_UPDATES.map((u) => (
              <li
                key={u.id}
                className="flex items-start gap-2.5 border-b border-[var(--line)] py-2 last:border-0"
              >
                <IconDoc />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                    {u.type}
                  </p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {u.eventName}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--muted)]">
                  {shortDay(u.when)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Secondary ops row */}
      <div className="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-3">
        <Panel
          compact
          className="h-full"
          title="Issues / Exceptions"
          action={<ViewLink href="/events/evt-ops-1/issues" label="Report issue" />}
          bodyClassName="px-3 py-2"
        >
          {SAMPLE_ISSUES.map((iss) => (
            <div key={iss.id} className="flex items-center justify-between gap-2 text-[12px]">
              <div className="min-w-0">
                <p className="truncate font-medium">{iss.title}</p>
                <p className="text-[11px] text-[var(--muted)]">
                  {iss.eventName} · {iss.type}
                </p>
              </div>
              <StatusPill compact tone="warn">
                {iss.status}
              </StatusPill>
            </div>
          ))}
        </Panel>

        <Panel
          compact
          className="h-full"
          title="Expenses"
          action={<ViewLink href="/costs/expenses" label="Submit expense" />}
          bodyClassName="px-3 py-2"
        >
          {SAMPLE_EXPENSES.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center justify-between gap-2 text-[12px]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{exp.description}</p>
                <p className="text-[11px] text-[var(--muted)]">
                  {exp.eventName} · {exp.category}
                </p>
              </div>
              <span className="tabular-nums font-semibold">
                <Money amount={exp.amount} />
              </span>
            </div>
          ))}
        </Panel>

        <Panel
          compact
          className="h-full"
          title="Documents"
          bodyClassName="px-3 py-1"
        >
          <ul>
            {SAMPLE_DOCUMENTS.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2 text-[12px] last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.name}</p>
                  <p className="text-[11px] text-[var(--muted)]">{doc.kind}</p>
                </div>
                <ViewLink href={doc.href} label="Open" />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
