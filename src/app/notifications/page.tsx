import Link from "next/link";
import { formatCurrency } from "@/features/billing/aging";
import {
  getManagerDashboardData,
  type ManagerDashboardData,
} from "@/features/dashboard/queries";
import { PageHeader, Panel, StatCard } from "@/components/billing/ui";
import { managerBoardLinks } from "@/features/users/role-nav";
import { getSessionUser } from "@/features/users/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const PREVIEW = 5;

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

export default async function ManagerDashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const boardTitle = "Notifications Center";

  let data: ManagerDashboardData;
  try {
    data = await getManagerDashboardData();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load dashboard.";
    return (
      <div className="space-y-4">
        <PageHeader
          title={boardTitle}
          description="Your action queue for risks, approvals, and deadlines."
        />
        <Panel title="Could not load live data">
          <p className="text-sm text-[var(--muted)]">{message}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Check connectivity, then refresh. Other modules still work from the sidebar.
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
  const approvals = data.pendingApprovals.slice(0, PREVIEW);

  const alertBadge = data.ar.openAlertCount || data.ar.overdueInvoiceCount;

  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader
          compact
          title="Notifications Center"
          description={`${greeting} Focus on urgent risks, approvals, deadlines, and billing exceptions.`}
        />
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

      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          compact
          label="Events at risk"
          value={String(attention.length)}
          hint="Needs follow-up"
          icon={<IconCalendar />}
          iconTone="orange"
        />
        <StatCard
          compact
          label="Pending approvals"
          value={String(approvals.length)}
          hint="Waiting on decision"
          icon={<IconUpcoming />}
          iconTone="orange"
        />
        <StatCard
          compact
          label="Upcoming deadlines"
          value={String(deadlines.length)}
          hint="Next due items"
          icon={<IconCurrency />}
          iconTone="blue"
        />
        <StatCard
          compact
          label="Billing alerts"
          value={String(alertBadge)}
          hint="Aging exceptions"
          icon={<IconBell />}
          iconTone="purple"
        />
      </div>
      <p className="shrink-0 text-[11px] text-[var(--muted)]">
        Profitability, budget comparisons, and A/R aging detail are on{" "}
        <Link href="/profitability" className="text-[var(--accent)] hover:underline">
          Profitability
        </Link>
        ,{" "}
        <Link href="/costs" className="text-[var(--accent)] hover:underline">
          Costs
        </Link>
        , and{" "}
        <Link href="/billing/aging" className="text-[var(--accent)] hover:underline">
          Aging
        </Link>
        .
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-3">
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
            title="Billing exceptions"
            action={<ViewAllLink href={links.alerts} />}
            bodyClassName="px-3 py-2"
          >
            <p className="text-[12px] text-[var(--muted)]">
              {alertBadge > 0
                ? `${alertBadge} aging or collection alert${alertBadge === 1 ? "" : "s"} need review.`
                : "No open billing alerts."}
            </p>
            <Link
              href={links.alerts}
              className="mt-2 inline-block text-[12px] font-medium text-[var(--accent)] hover:underline"
            >
              Open billing alerts →
            </Link>
          </Panel>
        </div>

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

        <div className="flex min-h-0 flex-col gap-2">
          <Panel
            compact
            className="min-h-0 flex-1"
            title="Where to dig deeper"
            bodyClassName="px-3 py-2 space-y-2"
          >
            <Link
              href="/costs"
              className="block rounded-md border border-[var(--line)] px-3 py-2 text-[12px] hover:bg-[#f7f9fb]"
            >
              <span className="font-semibold text-[var(--ink)]">Budget vs actual</span>
              <span className="mt-0.5 block text-[var(--muted)]">
                Cost dashboards and commitments
              </span>
            </Link>
            <Link
              href="/billing/aging"
              className="block rounded-md border border-[var(--line)] px-3 py-2 text-[12px] hover:bg-[#f7f9fb]"
            >
              <span className="font-semibold text-[var(--ink)]">A/R aging</span>
              <span className="mt-0.5 block text-[var(--muted)]">
                Outstanding {formatCurrency(data.kpis.outstandingAr)}
              </span>
            </Link>
            <Link
              href="/profitability"
              className="block rounded-md border border-[var(--line)] px-3 py-2 text-[12px] hover:bg-[#f7f9fb]"
            >
              <span className="font-semibold text-[var(--ink)]">Profitability</span>
              <span className="mt-0.5 block text-[var(--muted)]">
                Event margins and exceptions
              </span>
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}
