import {
  AiSummaryCard,
  ControlGate,
  EventHealthCard,
  NextActionCard,
} from "@/components/users/DashboardWidgets";
import {
  DonutChart,
  FunnelChart,
  FeatureCard,
  SectionHeader,
} from "@/components/dashboard";
import {
  Money,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/billing/ui";
import type { EventHealthItem, SessionUser } from "@/features/users/types";
import Link from "next/link";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ExecutiveDashboard({
  user,
  events,
}: {
  user: SessionUser;
  events: EventHealthItem[];
}) {
  const atRisk = events.filter((e) => e.status === "at_risk");
  const attention = events.filter((e) => e.status === "attention");
  const healthy = events.filter((e) => e.status === "healthy");

  return (
    <div>
      <PageHeader
        title="Executive dashboard"
        description={`Welcome, ${user.fullName}. Run the company across the full contract-to-cash lifecycle.`}
      />
      <div className="mb-4">
        <NextActionCard
          action="Review overdue invoices."
          detail="Two invoices are over 30 days — cash collection risk."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active events" value={String(events.length)} tone="accent" />
        <StatCard label="Contracted revenue" value={formatUsd(1240000)} hint="YTD" />
        <StatCard label="Cash collected" value={formatUsd(842000)} />
        <StatCard label="Outstanding AR" value={formatUsd(214500)} tone="warn" />
        <StatCard label="Customer deposits" value={formatUsd(128400)} hint="Unearned" />
        <StatCard label="Event gross profit" value={formatUsd(312000)} />
        <StatCard label="Avg event margin" value="28.4%" />
        <StatCard label="Events requiring attention" value={String(atRisk.length + attention.length)} tone="danger" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Event health distribution">
          <DonutChart
            centerLabel="Events"
            centerValue={String(events.length)}
            segments={[
              { label: "Healthy", value: healthy.length || 1, color: "#15803d" },
              { label: "Attention", value: attention.length || 1, color: "#ca8a04" },
              { label: "At risk", value: atRisk.length || 1, color: "#b91c1c" },
            ]}
          />
        </Panel>
        <Panel title="AR aging (demo)">
          <DonutChart
            centerLabel="AR"
            centerValue="$215k"
            segments={[
              { label: "Current", value: 90, color: "#0b6e6e" },
              { label: "1-30", value: 45, color: "#ca8a04" },
              { label: "31-60", value: 40, color: "#ea580c" },
              { label: "90+", value: 40, color: "#b91c1c" },
            ]}
          />
        </Panel>
        <Panel title="Workflow stage mix">
          <DonutChart
            segments={[
              { label: "Planning", value: 5, color: "#1d4ed8" },
              { label: "Execution", value: 3, color: "#0b6e6e" },
              { label: "Billing", value: 4, color: "#7c3aed" },
              { label: "Closeout", value: 2, color: "#64748b" },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-4">
        <SectionHeader title="Registration overview (portfolio)" description="Aggregated demo funnel across live events." />
        <Panel>
          <FunnelChart
            stages={[
              { title: "Invited", count: 1200, color: "#5b21b6" },
              { title: "Registered", count: 420, color: "#0f766e" },
              { title: "Confirmed", count: 360, color: "#15803d" },
              { title: "Checked in", count: 210, color: "#b45309" },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AiSummaryCard
          lines={[
            "Revenue increased 8% versus prior period.",
            `${atRisk.length || 1} event(s) require attention.`,
            "Two invoices are over 30 days.",
            "Labor costs exceeded budget by 12% on one gala.",
          ]}
        />
        <Panel title="Executive attention">
          <ul className="space-y-2 text-sm">
            <li>⚠ Missing deposits — Hope Harbor Charity Gala</li>
            <li>⚠ Overdue invoices — NovaTech final balance</li>
            <li>⚠ Budget overruns — Hope Harbor décor</li>
            <li>⚠ Missing approvals — Midwest Awards change order</li>
            <li>⚠ Incomplete planning — Partner Summit vendors</li>
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/events" className="font-semibold text-[var(--accent)] hover:underline">
              Open event operations →
            </Link>
          </p>
        </Panel>
      </div>
      <div className="mt-4 space-y-3">
        <h3 className="font-[family-name:var(--font-display)] text-lg">Event Health</h3>
        {events.map((e) => (
          <EventHealthCard key={e.id} event={e} expanded={e.status !== "healthy"} />
        ))}
      </div>
    </div>
  );
}

export function ProjectManagerDashboard({
  user,
  events,
}: {
  user: SessionUser;
  events: EventHealthItem[];
}) {
  const focus = events.find((e) => e.id === "eh-2") ?? events[0];
  return (
    <div>
      <PageHeader
        title="Project manager dashboard"
        description={`Welcome, ${user.fullName}. Deliver each event successfully through planning and execution.`}
      />
      <div className="mb-4">
        <NextActionCard
          action="Confirm catering by Friday."
          detail={focus ? `${focus.name} — vendor confirmation incomplete.` : undefined}
        />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          title="Event operations"
          description="Registration, QR, emails, speakers, agenda"
          actionLabel="Open events"
          href="/events"
        />
        <FeatureCard
          title="NovaTech launch"
          description="Near-term event — QR & check-in ready"
          actionLabel="Open"
          href="/events/evt-ops-1"
        />
        <FeatureCard
          title="Email campaigns"
          description="Simulated sends & approvals"
          actionLabel="Emails"
          href="/events/evt-ops-1/emails"
        />
        <FeatureCard
          title="Attendee registrations"
          description="Funnel and capacity"
          actionLabel="Registration"
          href="/events/evt-ops-1/registration"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned events" value={String(events.length)} tone="accent" />
        <StatCard label="Tasks due today" value="4" tone="warn" />
        <StatCard label="Missing approvals" value="2" tone="danger" />
        <StatCard label="Budget remaining" value={formatUsd(42000)} hint="Across active events" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Today — tasks & timeline">
          <ul className="space-y-2 text-sm">
            <li>• Confirm breakout room assignments — Meridian</li>
            <li>• Collect Hope Harbor deposit (blocks Ready)</li>
            <li>• Follow up seating chart approval — NovaTech</li>
            <li>• Issue vendor RFP — Partner Summit</li>
          </ul>
        </Panel>
        <ControlGate
          title="Ready gate — Hope Harbor Charity Gala"
          items={[
            { label: "Deposit received", ok: false },
            { label: "Vendors confirmed", ok: false },
            { label: "Customer approval", ok: true },
            { label: "Insurance on file", ok: true },
            { label: "Required documents", ok: true },
          ]}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Vendor status">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>ClearStage AV</span><StatusPill tone="ok">Confirmed</StatusPill></li>
            <li className="flex justify-between"><span>Elevated Plate</span><StatusPill tone="danger">Unconfirmed</StatusPill></li>
            <li className="flex justify-between"><span>ShieldPoint</span><StatusPill tone="warn">Pending</StatusPill></li>
          </ul>
        </Panel>
        <Panel title="Calendar (next 14 days)">
          <ul className="space-y-2 text-sm">
            <li>08/22 — NovaTech Product Launch</li>
            <li>09/18 — Meridian Leadership Conference</li>
            <li>09/19 — Meridian Client Dinner</li>
          </ul>
        </Panel>
        <Panel title="Weather / equipment">
          <p className="text-sm">Outdoor terrace dinner: monitor wind advisory for 09/19.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Equipment hold: 12 wireless mics, 2 switchers.</p>
        </Panel>
      </div>
      <div className="mt-4 space-y-3">
        {events.map((e) => (
          <EventHealthCard key={e.id} event={e} expanded={e.id === focus?.id} />
        ))}
      </div>
    </div>
  );
}

export function CoordinatorDashboard({ user }: { user: SessionUser }) {
  return (
    <div>
      <PageHeader
        title="Event coordinator dashboard"
        description={`Welcome, ${user.fullName}. Today's work for NovaTech Product Launch — tasks, schedule, speakers, and check-in.`}
      />
      <div className="mb-4">
        <NextActionCard
          action="Print badge stock is overdue — clear before load-in."
          detail="Also: 2 speakers still missing materials · survey email awaiting approval"
        />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Event feature hub"
          description="Registration, QR, emails, schedule, tasks"
          actionLabel="Open features"
          href="/events/evt-ops-1/features"
        />
        <FeatureCard
          title="QR check-in"
          description="Validate attendee passes on site"
          actionLabel="Open check-in"
          href="/events/evt-ops-1/qr"
        />
        <FeatureCard
          title="Speaker readiness"
          description="Checklists and materials tracking"
          actionLabel="Speakers"
          href="/events/evt-ops-1/speakers"
        />
        <FeatureCard
          title="Schedule"
          description="Month / week / day calendar"
          actionLabel="Open calendar"
          href="/events/evt-ops-1/schedule"
        />
        <FeatureCard
          title="Draft emails"
          description="Composer + PM approval (simulated send)"
          actionLabel="Emails"
          href="/events/evt-ops-1/emails"
        />
        <FeatureCard
          title="Open issues"
          description="On-site blockers and escalations"
          actionLabel="Issues"
          href="/events/evt-ops-1/issues"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tasks" value="3" tone="accent" hint="1 overdue" />
        <StatCard label="Events today" value="1" />
        <StatCard label="Time to enter" value="2.5 hrs" tone="warn" />
        <StatCard label="Speakers not ready" value="1" tone="danger" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Today's schedule">
          <ul className="space-y-2 text-sm">
            <li>06:00 — Room setup</li>
            <li>07:00 — Vendor load-in (Dock 2)</li>
            <li>08:30 — Attendee check-in opens</li>
            <li>10:00 — Keynote (Main Stage)</li>
            <li>16:00 — Strike / teardown</li>
          </ul>
          <Link
            href="/events/evt-ops-1/schedule"
            className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
          >
            Full calendar →
          </Link>
        </Panel>
        <Panel title="Shortcuts">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Tasks", href: "/events/evt-ops-1/tasks" },
              { label: "Time & expenses", href: "/events/evt-ops-1/time-expenses" },
              { label: "Documents", href: "/events/evt-ops-1/documents" },
              { label: "Agenda", href: "/events/evt-ops-1/agenda" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-left text-sm font-medium hover:border-[var(--accent)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function AccountingDashboard({ user }: { user: SessionUser }) {
  return (
    <div>
      <PageHeader
        title="Accounting dashboard"
        description={`Welcome, ${user.fullName}. Deposits, AR, recognition, and vendor bills — GAAP-aligned.`}
      />
      <div className="mb-4">
        <NextActionCard
          action="Invoice ABC Company."
          detail="Milestone ready — evidence on file for recognition path."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Deposits held" value={formatUsd(128400)} hint="Unearned revenue" tone="warn" />
        <StatCard label="Open AR" value={formatUsd(214500)} tone="danger" />
        <StatCard label="Ready to invoice" value="3" tone="accent" />
        <StatCard label="Vendor bills to review" value="5" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue recognition tracker">
          <ol className="space-y-3 text-sm">
            <li className="rounded-md border border-[var(--line)] p-3">
              <div className="flex justify-between gap-2">
                <span>Deposit $30,000</span>
                <StatusPill tone="warn">Unearned revenue</StatusPill>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">Hope Harbor — waiting event complete</p>
            </li>
            <li className="text-center text-[var(--muted)]">↓ Event complete / milestone complete</li>
            <li className="rounded-md border border-[var(--ok)]/30 bg-[#e8f6ee] p-3">
              <div className="flex justify-between gap-2">
                <span>Alumni Weekend settlement</span>
                <StatusPill tone="ok">Revenue recognized</StatusPill>
              </div>
            </li>
          </ol>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Control: revenue cannot be recognized until event or milestone is complete (and evidence exists).
          </p>
        </Panel>
        <Panel title="Controls">
          <ul className="space-y-2 text-sm">
            <li>⚠ Duplicate invoice detection — scan before issue</li>
            <li>⚠ Duplicate vendor-invoice warnings</li>
            <li>✓ Recognition blocked without evidence</li>
            <li>⚠ Partial payments need application review</li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md bg-[var(--bg)] p-3"><p className="text-[var(--muted)]">Cash collected</p><p className="mt-1 font-semibold"><Money amount={842000} /></p></div>
            <div className="rounded-md bg-[var(--bg)] p-3"><p className="text-[var(--muted)]">Customer deposits</p><p className="mt-1 font-semibold"><Money amount={128400} /></p></div>
            <div className="rounded-md bg-[var(--bg)] p-3"><p className="text-[var(--muted)]">Earned revenue</p><p className="mt-1 font-semibold"><Money amount={710000} /></p></div>
            <div className="rounded-md bg-[var(--bg)] p-3"><p className="text-[var(--muted)]">Billed / AR</p><p className="mt-1 font-semibold"><Money amount={214500} /></p></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function VendorDashboard({ user }: { user: SessionUser }) {
  return (
    <div>
      <PageHeader
        title="Vendor portal"
        description={`Welcome, ${user.fullName}. Complete assigned work only — no internal profitability.`}
      />
      <div className="mb-4">
        <NextActionCard
          action="Submit banquet layout for PM approval."
          detail="Seating capacity warning on Harbor Main Hall — Banquet alt"
        />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <FeatureCard
          title="Room layout planner"
          description="Drag objects, versions, and approvals"
          actionLabel="Open layouts"
          href="/vendor"
        />
        <FeatureCard
          title="Assigned event"
          description="NovaTech Product Launch work order"
          actionLabel="View assignment"
          href="/vendor"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Assigned event">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--muted)]">Event</dt><dd>NovaTech Product Launch</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--muted)]">Date</dt><dd>08/22/2026</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--muted)]">Arrival</dt><dd>07:00 AM</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--muted)]">Location</dt><dd>Harbor Innovation Hall</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--muted)]">Parking / load-in</dt><dd>Dock 2</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--muted)]">Contact</dt><dd>Morgan Manager</dd></div>
          </dl>
        </Panel>
        <Panel title="Work & invoice">
          <ul className="space-y-2 text-sm">
            <li>✓ Equipment list confirmed</li>
            <li>• Finalize room layout versions</li>
            <li>• Mark work complete</li>
            <li>• Upload invoice</li>
          </ul>
          <div className="mt-4 rounded-md bg-[var(--bg)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Vendor performance score
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">4.6 / 5</p>
            <p className="text-xs text-[var(--muted)]">On-time 96% · 18 events · Quality strong</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function CustomerDashboard({
  user,
  event,
}: {
  user: SessionUser;
  event: EventHealthItem;
}) {
  return (
    <div>
      <PageHeader
        title="My event"
        description={`Welcome, ${user.fullName}. Track progress, approvals, and invoices for your engagement.`}
      />
      <div className="mb-4">
        <NextActionCard action="Approve seating chart." detail="Pending since 08/01 — blocks final floor plan." />
      </div>
      <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Event countdown</p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">{event.name}</p>
        <p className="text-sm text-[var(--muted)]">{event.eventDate} · {event.customer}</p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#eef2f6]">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${event.progressPct}%` }} />
        </div>
        <p className="mt-2 text-sm font-medium">
          {event.progressPct}% — {event.stage}
        </p>
        <p className="text-xs text-[var(--muted)]">Live event progress (customers love progress bars).</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending approvals" value="1" tone="warn" />
        <StatCard label="Open invoices" value="1" />
        <StatCard label="Documents" value="6" />
        <StatCard label="Change orders" value="0" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Timeline & meetings">
          <ul className="space-y-2 text-sm">
            <li>✓ Contract signed</li>
            <li>✓ Deposit received</li>
            <li>• Seating chart approval</li>
            <li>• Final walkthrough — 08/20</li>
          </ul>
        </Panel>
        <Panel title="Billing snapshot">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Contract value</span><span><Money amount={142000} /></span></li>
            <li className="flex justify-between"><span>Paid to date</span><span><Money amount={106500} /></span></li>
            <li className="flex justify-between"><span>Balance</span><span><Money amount={35500} /></span></li>
          </ul>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Internal labor costs and vendor margins are hidden from this portal.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export function DepartmentManagerDashboard({ user }: { user: SessionUser }) {
  return (
    <div>
      <PageHeader
        title="Department manager — risk dashboard"
        description={`Welcome, ${user.fullName}. Approve based on risk — not just queue count.`}
      />
      <div className="mb-4">
        <NextActionCard action="Review change order #104." detail="HIGH RISK — budget exceeded on Hope Harbor." />
      </div>
      <div className="grid gap-4">
        {[
          { risk: "HIGH RISK", tone: "danger" as const, title: "Budget exceeded", detail: "Hope Harbor décor overage +$8,400" },
          { risk: "MEDIUM RISK", tone: "warn" as const, title: "Discount > 15%", detail: "NovaTech goodwill credit request" },
          { risk: "LOW RISK", tone: "ok" as const, title: "Travel expense", detail: "Coordinator mileage — $126" },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusPill tone={item.tone}>{item.risk}</StatusPill>
              <button type="button" className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white">
                Open in queue
              </button>
            </div>
            <p className="mt-2 font-semibold">{item.title}</p>
            <p className="text-sm text-[var(--muted)]">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Panel title="Approval queues">
          <p className="text-sm text-[var(--muted)]">
            Expenses · Discounts · Contracts · Refunds · Write-offs · Budget overrides
          </p>
          <a href="/approvals" className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline">
            Open approval queue →
          </a>
        </Panel>
      </div>
    </div>
  );
}

export function AdminDashboard({
  user,
  events,
}: {
  user: SessionUser;
  events: EventHealthItem[];
}) {
  return (
    <div>
      <PageHeader
        title="System administrator"
        description={`Welcome, ${user.fullName}. Manage directory and preview any operational surface.`}
      />
      <div className="mb-4">
        <NextActionCard
          action="Review role assignments for new hires."
          detail="Users & Roles module is your primary workspace."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Demo accounts" value="9" hint="gmail.com role logins" tone="accent" />
        <StatCard label="Roles" value="9" hint="Includes Attendee" />
        <StatCard label="Events tracked" value={String(events.length)} />
        <StatCard label="Modules live" value="4" hint="Users · Events · Billing · Compliance" />
      </div>
      <Panel title="Quick links">
        <ul className="space-y-2 text-sm">
          <li><a className="text-[var(--accent)] hover:underline" href="/users">Users & Roles overview</a></li>
          <li><a className="text-[var(--accent)] hover:underline" href="/events">Event operations</a></li>
          <li><a className="text-[var(--accent)] hover:underline" href="/attendee">Preview attendee portal</a></li>
          <li><a className="text-[var(--accent)] hover:underline" href="/billing">Billing template</a></li>
          <li><a className="text-[var(--accent)] hover:underline" href="/compliance">Compliance template</a></li>
        </ul>
      </Panel>
    </div>
  );
}
