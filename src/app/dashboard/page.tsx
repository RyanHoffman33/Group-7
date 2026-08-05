import Link from "next/link";
import {
  formatCurrency,
  formatPercent,
} from "@/features/billing/aging";
import {
  APPROACHING_BUDGET_THRESHOLD,
  getManagerDashboardData,
  type ManagerDashboardData,
} from "@/features/dashboard/queries";
import { Money, PageHeader, Panel, StatCard } from "@/components/billing/ui";
import { managerBoardLinks } from "@/features/users/role-nav";
import { getSessionUser } from "@/features/users/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const PREVIEW = 5;

const AGING_COLORS = {
  "0-30": "#2f9a57",
  "31-60": "#f0a202",
  "61-90": "#e07a2f",
  "90+": "#e11d48",
} as const;

type AgingKey = keyof typeof AGING_COLORS;

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function IconUpcoming() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
      <path d="M12 13v3l2 1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5">
      <path
        d="M12 3v18M17 8.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5 2.2 3.5 5 3.5 5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMargin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15l3.5-4.5L15 13l5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

function IconVendorFinder() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 10.5 5.5 5h13L20 10.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10.5V19a1 1 0 0 0 1 1h4v-5h6v5h4a1 1 0 0 0 1-1v-8.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.5" cy="16.5" r="3.5" />
      <path d="m19 19 2.5 2.5" strokeLinecap="round" />
    </svg>
  );
}

function shortRiskLabel(reason: string, amount?: number): string {
  const r = reason.toLowerCase();
  if (r.includes("over budget")) {
    return amount != null ? `${formatCurrency(amount)} over budget` : "Over budget";
  }
  if (r.includes("approaching budget")) return "Near budget limit";
  if (r.includes("over-committed") || r.includes("unexpected")) return "Cost overcommitted";
  if (r.includes("overdue task")) return "Overdue task";
  if (r.includes("unapproved change")) return "Change order pending";
  if (r.includes("not yet applied")) return "Change not applied";
  if (r.includes("overdue invoice")) return "Invoice overdue";
  if (r.includes("overdue deposit")) return "Deposit overdue";
  if (r.includes("incomplete work")) return "Work incomplete";
  if (r.includes("pending exception")) return "Exception pending";
  return reason.split(/\s+/).slice(0, 4).join(" ");
}

function TrendUp() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M6 2.5 10 8H2L6 2.5Z" />
    </svg>
  );
}

function TrendDown() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M6 9.5 2 4h8L6 9.5Z" />
    </svg>
  );
}

function SeverityDot({ severity }: { severity: "urgent" | "warning" }) {
  return (
    <span
      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
        severity === "urgent" ? "bg-[#e11d48]" : "bg-[#f59e0b]"
      }`}
      aria-hidden="true"
    />
  );
}

function shortDay(dateStr: string): string {
  const d = new Date(`${dateStr.includes("T") ? dateStr : dateStr + "T00:00:00"}`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ViewAllLink({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="text-[12px] font-medium text-[var(--accent)] hover:underline"
    >
      {label}
    </Link>
  );
}

function BudgetActualChart({
  rows,
}: {
  rows: { contractId: string; eventName: string; budgeted: number; actual: number }[];
}) {
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.budgeted, r.actual]));
  const ticks = [0, 0.5, 1].map((t) => t * maxVal);

  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[10px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-[#34a853]" aria-hidden="true" />
          Budget
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-sm bg-[#c5ced8]" aria-hidden="true" />
          Actual
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const budgetPct = Math.min(100, (row.budgeted / maxVal) * 100);
          const actualPct = Math.min(100, (row.actual / maxVal) * 100);
          return (
            <div key={row.contractId}>
              <p className="mb-1 truncate text-[11px] font-medium text-[var(--ink)]">
                {row.eventName}
              </p>
              <div className="space-y-0.5">
                <div className="h-1.5 overflow-hidden rounded-sm bg-[#eef2f6]">
                  <div className="h-full rounded-sm bg-[#34a853]" style={{ width: `${budgetPct}%` }} />
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-[#eef2f6]">
                  <div className="h-full rounded-sm bg-[#c5ced8]" style={{ width: `${actualPct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-1.5 text-[10px] tabular-nums text-[var(--muted)]">
        {ticks.map((t, i) => (
          <span key={i}>{t >= 1000 ? `${Math.round(t / 1000)}K` : Math.round(t)}</span>
        ))}
      </div>
    </div>
  );
}

function AgingDonut({
  buckets,
  total,
}: {
  buckets: { key: AgingKey; label: string; amount: number }[];
  total: number;
}) {
  const size = 120;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  if (total <= 0) {
    return (
      <div
        className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full border-[20px] border-[#e8eef3]"
        aria-label="No outstanding A/R"
      />
    );
  }

  let offset = 0;
  const segments = buckets
    .filter((b) => b.amount > 0)
    .map((b) => {
      const len = (b.amount / total) * c;
      const seg = { key: b.key, color: AGING_COLORS[b.key], len, offset };
      offset += len;
      return seg;
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label="Outstanding A/R aging"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8eef3" strokeWidth={stroke} />
      {segments.map((s) => (
        <circle
          key={s.key}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${s.len} ${c - s.len}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  );
}

export default async function ManagerDashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  let data: ManagerDashboardData;
  try {
    data = await getManagerDashboardData();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load dashboard.";
    return (
      <div className="space-y-4">
        <PageHeader
          title="Manager Dashboard"
          description="Portfolio overview for your role."
        />
        <Panel title="Could not load live data">
          <p className="text-sm text-[var(--muted)]">{message}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Check Supabase connectivity, then refresh. Sidebar modules still work.
          </p>
        </Panel>
      </div>
    );
  }

  const links = managerBoardLinks(session.roleKey);
  const greetingName = data.managerFirstName;
  const greeting = greetingName
    ? `Welcome back, ${greetingName}!`
    : `Welcome back, ${session.fullName.split(" ")[0]}!`;

  const attention = data.attention.slice(0, PREVIEW);
  const deadlines = data.deadlines.slice(0, PREVIEW);
  const budgetRows = data.budgetVsActual.slice(0, PREVIEW);
  const profitRows = data.profitability.slice(0, PREVIEW);
  const approvals = data.pendingApprovals.slice(0, PREVIEW);

  const activeEventsKpi = data.kpis.activeEvents;
  const upcomingEventsKpi = data.kpis.upcomingEvents;
  const alertBadge = data.ar.openAlertCount || data.ar.overdueInvoiceCount;

  const agingBuckets = [
    {
      key: "0-30" as const,
      label: "0-30 Days",
      amount: (data.ar.byBucket.current ?? 0) + (data.ar.byBucket["1-30"] ?? 0),
    },
    {
      key: "31-60" as const,
      label: "31-60 Days",
      amount: data.ar.byBucket["31-60"] ?? 0,
    },
    {
      key: "61-90" as const,
      label: "61-90 Days",
      amount: data.ar.byBucket["61-90"] ?? 0,
    },
    {
      key: "90+" as const,
      label: "90+ Days",
      amount: data.ar.byBucket["90+"] ?? 0,
    },
  ];
  const agingTotal = agingBuckets.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader compact title="Manager Dashboard" description={greeting} />
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={links.costs}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[#f7f9fb]"
            aria-label="Costs"
            title="Costs"
          >
            <IconVendorFinder />
          </Link>
          <Link
            href={links.alerts}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[#f7f9fb]"
            aria-label="Alerts"
            title="Billing alerts"
          >
            <IconBell />
            {alertBadge > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-bold text-white">
                {alertBadge > 9 ? "9+" : alertBadge}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {/* KPI strip with colored icon tiles */}
      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          compact
          label="Active Events"
          value={String(activeEventsKpi)}
          hint="In progress"
          icon={<IconCalendar />}
          iconTone="blue"
        />
        <StatCard
          compact
          label="Upcoming Events"
          value={String(upcomingEventsKpi)}
          hint="Next 30 days"
          icon={<IconUpcoming />}
          iconTone="green"
        />
        <StatCard
          compact
          label="Outstanding A/R"
          value={formatCurrency(data.kpis.outstandingAr)}
          hint="Net of payment applications"
          icon={<IconCurrency />}
          iconTone="orange"
        />
        <StatCard
          compact
          label="Avg. Profit Margin"
          value={
            data.kpis.averageProfitMargin == null
              ? "—"
              : formatPercent(data.kpis.averageProfitMargin)
          }
          hint="Recognized − direct COGS"
          icon={<IconMargin />}
          iconTone="purple"
        />
      </div>

      {/* 3-column body fills remaining height */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-3">
        {/* Left */}
        <div className="flex min-h-0 flex-col gap-2">
          <Panel
            compact
            className="min-h-0 flex-1"
            title="Events at Risk"
            action={<ViewAllLink href={links.events} />}
            bodyClassName="px-3 py-0.5"
          >
            {attention.length === 0 ? (
              <p className="py-2 text-[12px] text-[var(--muted)]">
                No operational issues detected.
              </p>
            ) : (
              <ul>
                {attention.map((item) => (
                  <li key={item.id} className="border-b border-[var(--line)] last:border-0">
                    <Link
                      href={item.href}
                      className="flex items-start gap-2 py-1.5 transition hover:bg-[#f7f9fb]"
                    >
                      <SeverityDot severity={item.severity} />
                      <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--ink)]">
                        {item.eventName}
                      </p>
                      <span
                        className={`max-w-[48%] shrink-0 truncate text-right text-[11px] font-medium ${
                          item.severity === "urgent" ? "text-[#e11d48]" : "text-[#d97706]"
                        }`}
                        title={item.reason}
                      >
                        {shortRiskLabel(item.reason, item.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            compact
            className="min-h-0 flex-1"
            title="Event Profitability"
            action={<ViewAllLink href="/profitability" />}
            bodyClassName="px-3 py-0.5"
          >
            {profitRows.length === 0 ? (
              <p className="py-2 text-[12px] text-[var(--muted)]">
                No profitability inputs yet.
              </p>
            ) : (
              <ul>
                {profitRows.map((p) => {
                  const up = (p.margin ?? 0) >= 0.2 || p.tone === "ok";
                  const down =
                    p.tone === "danger" || (p.margin != null && p.margin < 0);
                  return (
                    <li
                      key={p.contractId}
                      className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-1.5 last:border-0"
                    >
                      <p className="min-w-0 truncate text-[12px] font-medium text-[var(--ink)]">
                        {p.eventName}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums ${
                          down
                            ? "text-[#e11d48]"
                            : up
                              ? "text-[#2f9a57]"
                              : "text-[var(--ink)]"
                        }`}
                      >
                        {p.margin == null ? "—" : formatPercent(p.margin)}
                        {down ? <TrendDown /> : up ? <TrendUp /> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* Middle */}
        <div className="flex min-h-0 flex-col gap-2">
          <Panel
            compact
            className="min-h-0 flex-1 border-l-4 border-l-[#2563eb]"
            title="Upcoming Deadlines"
            action={<ViewAllLink href={links.events} />}
            bodyClassName="px-3 py-0.5"
          >
            {deadlines.length === 0 ? (
              <p className="py-2 text-[12px] text-[var(--muted)]">No open deadlines.</p>
            ) : (
              <ul>
                {deadlines.map((d) => (
                  <li key={d.id} className="border-b border-[var(--line)] last:border-0">
                    <Link
                      href={d.href}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-[var(--ink)]">
                          {d.name}
                        </p>
                        <p className="truncate text-[11px] text-[var(--muted)]">
                          {d.eventName}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--ink)]">
                        {shortDay(d.dueDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            compact
            className="min-h-0 flex-1 border-l-4 border-l-[#d97706]"
            title="Pending Approvals"
            action={<ViewAllLink href={links.changeOrders} />}
            bodyClassName="px-3 py-0.5"
          >
            {approvals.length === 0 ? (
              <p className="py-2 text-[12px] text-[var(--muted)]">
                Nothing awaiting approval.
              </p>
            ) : (
              <ul>
                {approvals.map((row) => (
                  <li key={row.id} className="border-b border-[var(--line)] last:border-0">
                    <Link
                      href={row.href}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-[var(--ink)]">
                          {row.type}
                        </p>
                        <p className="truncate text-[11px] text-[var(--muted)]">
                          {row.eventName}
                        </p>
                      </div>
                      {row.amount != null ? (
                        <span className="shrink-0 rounded-md bg-[#fff7eb] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[#d97706]">
                          {formatCurrency(row.amount)}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md bg-[#fff7eb] px-2 py-0.5 text-[11px] font-medium text-[#d97706]">
                          {row.status}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Right: Budget chart + A/R aging donut */}
        <div className="flex min-h-0 flex-col gap-2">
          <Panel
            compact
            className="min-h-0 flex-1"
            title="Budget vs. Actual"
            action={
              <span className="text-[10px] text-[var(--muted)]">
                Top {PREVIEW} · warn @{Math.round(APPROACHING_BUDGET_THRESHOLD * 100)}%+
              </span>
            }
            bodyClassName="px-3 py-2"
          >
            {budgetRows.length === 0 ? (
              <p className="py-2 text-[12px] text-[var(--muted)]">No cost budgets.</p>
            ) : (
              <BudgetActualChart rows={budgetRows} />
            )}
          </Panel>

          <Panel
            compact
            className="min-h-0 flex-1"
            title="Outstanding A/R Aging"
            action={<ViewAllLink href={links.aging} />}
            bodyClassName="flex flex-col justify-center px-3 py-2.5"
          >
            {agingTotal <= 0 ? (
              <p className="text-[12px] text-[var(--muted)]">No outstanding A/R.</p>
            ) : (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
                <AgingDonut buckets={agingBuckets} total={agingTotal} />
                <ul className="w-full min-w-0 space-y-1.5">
                  {agingBuckets.map((b) => (
                    <li
                      key={b.key}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: AGING_COLORS[b.key] }}
                          aria-hidden="true"
                        />
                        <span className="truncate text-[var(--muted)]">{b.label}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        <Money amount={b.amount} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
