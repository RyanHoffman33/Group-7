import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatCurrency,
  formatPercent,
} from "@/features/billing/aging";
import {
  getManagerDashboardData,
  type ManagerDashboardData,
} from "@/features/dashboard/queries";
import { Money, PageHeader, Panel, StatCard } from "@/components/billing/ui";
import { roleHasPermission } from "@/features/access/matrix";
import {
  homePathForRole,
  managerBoardLinks,
  navSectionsForRole,
  notificationsPathForRole,
  type NavSection,
} from "@/features/users/role-nav";
import { getSessionUser } from "@/features/users/session";
import type { AppRole } from "@/features/users/types";

export const dynamic = "force-dynamic";

function shortDay(dateStr: string): string {
  const d = new Date(
    `${dateStr.includes("T") ? dateStr : dateStr + "T00:00:00"}`,
  );
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5">
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

type Shortcut = { href: string; label: string; hint: string };

function shortcutsForRole(
  roleKey: AppRole,
  sections: NavSection[],
  notificationsHref: string | null,
): Shortcut[] {
  const items: Shortcut[] = [];

  if (sections.includes("intake")) {
    items.push({
      href: "/engagement/approvals",
      label: "Sales & Intake",
      hint: "Inquiries, quotes & vendor sourcing",
    });
  }
  if (sections.includes("contracts")) {
    items.push({
      href: "/contracts",
      label: "Contracts",
      hint: "Active contracts & change orders",
    });
  }
  if (sections.includes("billing")) {
    items.push({
      href: "/billing",
      label: "Billing",
      hint: "Invoices, deposits & A/R",
    });
  }
  if (sections.includes("analytics") || sections.includes("profitability")) {
    items.push({
      href: sections.includes("analytics") ? "/analytics" : "/profitability",
      label: "Analytics",
      hint: "Trends, forecasts & margin",
    });
  }
  if (sections.includes("work")) {
    items.push({
      href: "/work",
      label: "Work",
      hint: "Event board & exceptions",
    });
  } else if (sections.includes("events")) {
    items.push({
      href: "/events",
      label: "Events",
      hint: "Event operations",
    });
  }
  if (notificationsHref) {
    items.push({
      href: notificationsHref,
      label: "Notifications Center",
      hint: "Alerts, deadlines & attention",
    });
  }
  if (sections.includes("approvals") && items.length < 5) {
    items.push({
      href: "/approvals",
      label: "Approvals",
      hint: "Items awaiting your decision",
    });
  }
  if (roleKey === "accounting" && sections.includes("compliance") && items.length < 6) {
    items.push({
      href: "/compliance/recognition",
      label: "Recognition",
      hint: "GAAP revenue posting",
    });
  }

  return items.slice(0, 6);
}

export default async function MyDashboardHomePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const home = homePathForRole(session.roleKey);
  if (home !== "/home") redirect(home);

  const sections = navSectionsForRole(session.roleKey);
  const notificationsHref = notificationsPathForRole(session.roleKey);
  const links = managerBoardLinks(session.roleKey);
  const shortcuts = shortcutsForRole(
    session.roleKey,
    sections,
    notificationsHref,
  );

  const showAr =
    roleHasPermission(session.roleKey, "billing.read") ||
    roleHasPermission(session.roleKey, "ar.read");
  const showMargin = roleHasPermission(session.roleKey, "profitability.read");

  let data: ManagerDashboardData | null = null;
  let loadError: string | null = null;
  try {
    data = await getManagerDashboardData();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unable to load overview.";
  }

  const firstName =
    data?.managerFirstName ?? session.fullName.split(" ")[0] ?? "there";
  const attentionCount = data?.attention.length ?? 0;
  const overdueCount = data?.ar.overdueInvoiceCount ?? 0;
  const deadlines = (data?.deadlines ?? []).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="My Dashboard"
        description={`Welcome back, ${firstName}.`}
      />
      <p className="-mt-4 text-sm text-[var(--muted)]">
        Orientation for Contract-to-Cash — jump to work, or open Notifications
        Center for the full attention board.
      </p>

      {loadError ? (
        <Panel title="Overview unavailable">
          <p className="text-sm text-[var(--muted)]">{loadError}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Sidebar modules still work. Try Notifications Center after
            reconnecting.
          </p>
        </Panel>
      ) : (
        <div
          className={`grid gap-3 sm:grid-cols-2 ${
            showAr && showMargin
              ? "xl:grid-cols-4"
              : showAr || showMargin
                ? "xl:grid-cols-3"
                : "xl:grid-cols-2"
          }`}
        >
          <StatCard
            label="Active Events"
            value={String(data?.kpis.activeEvents ?? 0)}
            hint="In progress"
            icon={<IconCalendar />}
            iconTone="blue"
          />
          {showAr ? (
            <StatCard
              label="Outstanding A/R"
              value={formatCurrency(data?.kpis.outstandingAr ?? 0)}
              hint={
                overdueCount > 0
                  ? `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`
                  : "Net of payment applications"
              }
              icon={<IconCurrency />}
              iconTone="orange"
              tone={overdueCount > 0 ? "warn" : "default"}
            />
          ) : null}
          {showMargin ? (
            <StatCard
              label="Avg. Profit Margin"
              value={
                data?.kpis.averageProfitMargin == null
                  ? "—"
                  : formatPercent(data.kpis.averageProfitMargin)
              }
              hint="Recognized − direct COGS"
              icon={<IconMargin />}
              iconTone="teal"
            />
          ) : null}
          <StatCard
            label="Needs Attention"
            value={String(attentionCount)}
            hint={
              notificationsHref
                ? "Open Notifications Center"
                : "Operational flags"
            }
            icon={<IconBell />}
            iconTone="orange"
            tone={attentionCount > 0 ? "warn" : "default"}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Jump to work">
          <ul className="grid gap-2 sm:grid-cols-2">
            {shortcuts.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md border border-[var(--line)] bg-[#f7f9fb] px-3 py-3 transition hover:border-[var(--accent)]/35 hover:bg-white"
                >
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                    {item.hint}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Upcoming deadlines"
          action={
            notificationsHref ? (
              <Link
                href={notificationsHref}
                className="text-[12px] font-medium text-[var(--accent)] hover:underline"
              >
                View all
              </Link>
            ) : undefined
          }
        >
          {deadlines.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No open deadlines.</p>
          ) : (
            <ul>
              {deadlines.map((d) => (
                <li
                  key={d.id}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <Link
                    href={d.href}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--ink)]">
                        {d.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--muted)]">
                        {d.eventName}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[12px] font-medium tabular-nums ${
                        d.overdue ? "text-[var(--danger)]" : "text-[var(--ink)]"
                      }`}
                    >
                      {shortDay(d.dueDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {showAr && (data?.ar.openAlertCount ?? 0) > 0 ? (
            <p className="mt-3 border-t border-[var(--line)] pt-3 text-[12px] text-[var(--muted)]">
              A/R highlight:{" "}
              <Link
                href={links.aging}
                className="font-medium text-[var(--accent)] hover:underline"
              >
                <Money amount={data?.kpis.outstandingAr ?? 0} /> outstanding
              </Link>
              {overdueCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={links.alerts}
                    className="font-medium text-[var(--warn)] hover:underline"
                  >
                    {overdueCount} overdue
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
