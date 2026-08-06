"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { logoutAction } from "@/features/users/actions";
import type { AppRole } from "@/features/users/types";
import { roleHasPermission } from "@/features/access/matrix";
import {
  homePathForRole,
  notificationsPathForRole,
  type NavSection,
} from "@/features/users/role-nav";
import { DemoRoleSwitcher } from "@/components/layout/DemoRoleSwitcher";

const billingLinksAll = [
  { href: "/billing", label: "A/R Dashboard" },
  { href: "/billing/determine", label: "Determine Charges" },
  { href: "/billing/invoices", label: "Invoices" },
  { href: "/billing/payments", label: "Payments" },
  { href: "/billing/deposits", label: "Deposits" },
  { href: "/billing/recurring", label: "Recurring & Drafts" },
  { href: "/billing/aging", label: "Aging & Collections" },
  { href: "/billing/alerts", label: "Billing Alerts" },
];

const complianceLinks = [
  { href: "/compliance", label: "Contract Position" },
  { href: "/compliance/recognition", label: "Recognition" },
  { href: "/compliance/deposits-retainers", label: "Deposits & Retainers" },
  { href: "/compliance/modifications", label: "Modifications" },
  { href: "/compliance/costs", label: "Cost Classification" },
  { href: "/compliance/audit", label: "Audit Pack" },
  { href: "/compliance/policies", label: "Policies" },
];

const usersLinksAll = [
  { href: "/users", label: "Overview" },
  { href: "/users/directory", label: "Directory" },
  { href: "/users/roles", label: "Roles", needsManage: true },
  { href: "/users/permissions", label: "Permissions", needsManage: true },
  { href: "/users/assignments", label: "Assignments", needsManage: true },
  { href: "/users/audit", label: "Access Audit", needsAudit: true },
];

const eventsLinks = [
  { href: "/events", label: "All Events" },
  { href: "/events/hub", label: "Event Hub" },
];

const vendorLinks = [
  { href: "/vendor/layouts/lay-1", label: "Theater Layout" },
  { href: "/vendor/layouts/lay-2", label: "Banquet Layout" },
];

const attendeeLinks = [{ href: "/attendee/survey", label: "Event Survey" }];

const customerLinks = [
  { href: "/dashboard/customer", label: "Overview" },
  { href: "/dashboard/customer/event", label: "Event Details" },
  { href: "/dashboard/customer/actions", label: "Action Items" },
  { href: "/dashboard/customer/invoices", label: "Invoices" },
  { href: "/dashboard/customer/payments", label: "Payments" },
  { href: "/dashboard/customer/documents", label: "Documents" },
];

const contractsLinksAll = [
  { href: "/contracts", label: "Contracts Dashboard" },
  { href: "/contracts/list", label: "All Contracts" },
  { href: "/contracts/new", label: "Create Contract", needsWrite: true },
  { href: "/contracts/approvals", label: "Approvals" },
  { href: "/contracts/change-orders", label: "Change Orders" },
  { href: "/contracts/closeout", label: "Contract Closeout" },
];

const workLinks = [
  { href: "/work", label: "Event Board" },
  { href: "/work/exceptions", label: "Exception Inbox" },
];

const costsLinksFull = [
  { href: "/costs", label: "Cost Dashboard" },
  { href: "/costs/time", label: "Time Entry" },
  { href: "/costs/expenses", label: "Vendor & Expenses" },
  { href: "/costs/commitments", label: "Commitments" },
  { href: "/costs/approvals", label: "Approval Queue" },
  { href: "/costs/flags", label: "Flags & Exceptions" },
  { href: "/costs/reports", label: "Reports / Export" },
];

const costsLinksSubmit = [
  { href: "/costs/time", label: "Time Entry" },
  { href: "/costs/expenses", label: "Submit Expenses" },
];

const analyticsCoreLinks = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/history", label: "History" },
  { href: "/analytics/projections", label: "Projections" },
];

const profitabilitySubLinks = [
  { href: "/profitability", label: "Profitability" },
  { href: "/profitability/exceptions", label: "Profitability Exceptions" },
];

const billingLinksRead = [
  { href: "/billing", label: "A/R Dashboard" },
  { href: "/billing/invoices", label: "Invoices" },
  { href: "/billing/aging", label: "Aging & Collections" },
  { href: "/billing/alerts", label: "Billing Alerts" },
];

function navForRole(roleKey: AppRole) {
  const canManageUsers =
    roleHasPermission(roleKey, "users.manage") ||
    roleHasPermission(roleKey, "roles.manage");
  const canAudit = roleHasPermission(roleKey, "audit.read");
  const canWriteContracts = roleHasPermission(roleKey, "contracts.write");
  const canWriteBilling = roleHasPermission(roleKey, "billing.write");

  return {
    users: usersLinksAll
      .filter((l) => {
        if ("needsManage" in l && l.needsManage) return canManageUsers;
        if ("needsAudit" in l && l.needsAudit) return canAudit;
        return true;
      })
      .map(({ href, label }) => ({ href, label })),
    events: eventsLinks,
    contracts: contractsLinksAll
      .filter((l) => !("needsWrite" in l && l.needsWrite) || canWriteContracts)
      .map(({ href, label }) => ({ href, label })),
    billing: canWriteBilling ? billingLinksAll : billingLinksRead,
    costs:
      roleKey === "event_coordinator" ||
      (!roleHasPermission(roleKey, "costs.read") &&
        roleHasPermission(roleKey, "expenses.submit"))
        ? costsLinksSubmit
        : costsLinksFull,
  };
}

function isBillingRoute(pathname: string) {
  return pathname === "/billing" || pathname.startsWith("/billing/");
}

function isComplianceRoute(pathname: string) {
  return pathname === "/compliance" || pathname.startsWith("/compliance/");
}

function isUsersRoute(pathname: string) {
  return pathname === "/users" || pathname.startsWith("/users/");
}

function isEventsRoute(pathname: string) {
  return pathname === "/events" || pathname.startsWith("/events/");
}

function isAttendeeRoute(pathname: string) {
  return pathname === "/attendee" || pathname.startsWith("/attendee/");
}

function isVendorRoute(pathname: string) {
  return pathname === "/vendor" || pathname.startsWith("/vendor/");
}

function isContractsRoute(pathname: string) {
  return pathname === "/contracts" || pathname.startsWith("/contracts/");
}

function isWorkRoute(pathname: string) {
  return pathname === "/work" || pathname.startsWith("/work/");
}

function isCostsRoute(pathname: string) {
  return pathname === "/costs" || pathname.startsWith("/costs/");
}

function isProfitabilityRoute(pathname: string) {
  return pathname === "/profitability" || pathname.startsWith("/profitability/");
}

function isAnalyticsRoute(pathname: string) {
  return pathname === "/analytics" || pathname.startsWith("/analytics/");
}

function isMyDashboardActive(pathname: string, roleKey: AppRole) {
  const home = homePathForRole(roleKey);
  if (home === "/home") return pathname === "/home";
  return pathname === home || pathname.startsWith(`${home}/`);
}

function isNotificationsActive(pathname: string, roleKey: AppRole) {
  const href = notificationsPathForRole(roleKey);
  if (!href) return false;
  if (href === "/notifications") {
    return pathname === "/notifications" || pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isLinkActive(pathname: string, href: string) {
  if (href === "/events/hub") {
    return (
      pathname === "/events/hub" ||
      (pathname.startsWith("/events/") && pathname !== "/events")
    );
  }
  // Customer portal overview must match exactly (not child routes).
  if (href === "/dashboard/customer") {
    return pathname === "/dashboard/customer";
  }
  if (
    href === "/billing" ||
    href === "/compliance" ||
    href === "/users" ||
    href === "/events" ||
    href === "/attendee" ||
    href === "/vendor" ||
    href === "/home" ||
    href === "/notifications" ||
    href === "/contracts" ||
    href === "/work" ||
    href === "/costs" ||
    href === "/profitability" ||
    href === "/analytics" ||
    href === "/dashboard"
  ) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavAccordion({
  title,
  open,
  onToggle,
  active,
  controlsId,
  links,
  pathname,
  badge,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  controlsId: string;
  links: { href: string; label: string }[];
  pathname: string;
  badge?: number;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={controlsId}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${
          active
            ? "bg-white/12 text-white"
            : "text-white/70 hover:bg-white/8 hover:text-white"
        }`}
      >
        <span>{title}</span>
        {typeof badge === "number" && badge > 0 ? (
          <span className="rounded-full bg-[var(--danger)] px-2 py-0.5 text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : (
          <span className="text-white/40">{open ? "-" : "+"}</span>
        )}
      </button>
      {open ? (
        <ul id={controlsId} className="mt-1 space-y-0.5 border-l border-white/10 ml-3 pl-2">
          {links.map((link) => {
            const activeLink = isLinkActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded-md px-3 py-2 text-sm transition ${
                    activeLink
                      ? "bg-white/12 text-white"
                      : "text-white/55 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

export function AppShell({
  children,
  alertCount = 0,
  session,
  navSections,
}: {
  children: React.ReactNode;
  alertCount?: number;
  session: {
    fullName: string;
    email: string;
    roleName: string;
    roleKey: AppRole;
  };
  navSections: NavSection[];
}) {
  const pathname = usePathname();
  const billingActive = isBillingRoute(pathname);
  const complianceActive = isComplianceRoute(pathname);
  const usersActive = isUsersRoute(pathname);
  const eventsActive = isEventsRoute(pathname);
  const attendeeActive = isAttendeeRoute(pathname);
  const vendorActive = isVendorRoute(pathname);
  const contractsActive = isContractsRoute(pathname);
  const workActive = isWorkRoute(pathname);
  const costsActive = isCostsRoute(pathname);
  const profitabilityActive = isProfitabilityRoute(pathname);
  const analyticsRouteActive = isAnalyticsRoute(pathname);
  const analyticsCenterActive = analyticsRouteActive || profitabilityActive;
  const myDashboardHref = homePathForRole(session.roleKey);
  const myDashboardActive = isMyDashboardActive(pathname, session.roleKey);
  const notificationsHref = notificationsPathForRole(session.roleKey);
  const notificationsActive = isNotificationsActive(pathname, session.roleKey);
  const showNotifications = navSections.includes("notifications");
  const showUsers = navSections.includes("users");
  const showBilling = navSections.includes("billing");
  const showCompliance = navSections.includes("compliance");
  const showEvents = navSections.includes("events");
  const showAttendee = navSections.includes("attendee");
  const showVendor = navSections.includes("vendor");
  const showApprovals = navSections.includes("approvals");
  const showContracts = navSections.includes("contracts");
  const showWork = navSections.includes("work");
  const showCosts = navSections.includes("costs");
  const showProfitability = navSections.includes("profitability");
  const showAnalyticsCore = navSections.includes("analytics");
  const showAnalyticsCenter = showAnalyticsCore || showProfitability;
  const analyticsCenterLinks = [
    ...(showAnalyticsCore ? analyticsCoreLinks : []),
    ...(showProfitability ? profitabilitySubLinks : []),
  ];
  const showCustomer = navSections.includes("customer");
  const roleNav = navForRole(session.roleKey);
  const homeOnly =
    navSections.includes("home_only") &&
    !showBilling &&
    !showCompliance &&
    !showUsers &&
    !showEvents &&
    !showAttendee &&
    !showVendor &&
    !showCustomer &&
    !showApprovals &&
    !showContracts &&
    !showWork &&
    !showCosts &&
    !showAnalyticsCenter;

  const [billingOpen, setBillingOpen] = useState(billingActive);
  const [complianceOpen, setComplianceOpen] = useState(complianceActive);
  const [usersOpen, setUsersOpen] = useState(usersActive);
  const [eventsOpen, setEventsOpen] = useState(eventsActive);
  const [attendeeOpen, setAttendeeOpen] = useState(attendeeActive);
  const [vendorOpen, setVendorOpen] = useState(vendorActive);
  const [customerOpen, setCustomerOpen] = useState(showCustomer && myDashboardActive);
  const [contractsOpen, setContractsOpen] = useState(contractsActive);
  const [workOpen, setWorkOpen] = useState(workActive);
  const [costsOpen, setCostsOpen] = useState(costsActive);
  const [analyticsOpen, setAnalyticsOpen] = useState(analyticsCenterActive);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (billingActive) setBillingOpen(true);
  }, [billingActive]);

  useEffect(() => {
    if (complianceActive) setComplianceOpen(true);
  }, [complianceActive]);

  useEffect(() => {
    if (usersActive) setUsersOpen(true);
  }, [usersActive]);

  useEffect(() => {
    if (eventsActive) setEventsOpen(true);
  }, [eventsActive]);

  useEffect(() => {
    if (attendeeActive) setAttendeeOpen(true);
  }, [attendeeActive]);

  useEffect(() => {
    if (vendorActive) setVendorOpen(true);
  }, [vendorActive]);

  useEffect(() => {
    if (contractsActive) setContractsOpen(true);
  }, [contractsActive]);

  useEffect(() => {
    if (workActive) setWorkOpen(true);
  }, [workActive]);

  useEffect(() => {
    if (costsActive) setCostsOpen(true);
  }, [costsActive]);

  useEffect(() => {
    if (analyticsCenterActive) setAnalyticsOpen(true);
  }, [analyticsCenterActive]);

  useEffect(() => {
    if (myDashboardActive && showCustomer) setCustomerOpen(true);
  }, [myDashboardActive, showCustomer]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="flex min-h-screen flex-col border-b border-[var(--line)] bg-[var(--ink)] text-white lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="px-5 pb-4 pt-7">
          <Link
            href={myDashboardHref}
            className="group flex items-end gap-3.5"
            aria-label="MainEvent home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/mainevent-mark.png?v=5"
              alt=""
              width={200}
              height={140}
              className="h-12 w-auto shrink-0 object-contain object-left opacity-95 transition-opacity group-hover:opacity-100"
            />
            <span className="pb-0.5 text-[1.5rem] font-semibold leading-none tracking-[-0.02em] text-white">
              MainEvent
            </span>
          </Link>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
            Contract to Cash
          </p>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Primary">
          <ul className="space-y-1">
            <li>
              <Link
                href={myDashboardHref}
                className={`block rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  myDashboardActive
                    ? "bg-white/12 text-white"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                My Dashboard
              </Link>
            </li>
            {showNotifications && notificationsHref ? (
              <li>
                <Link
                  href={notificationsHref}
                  className={`block rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    notificationsActive
                      ? "bg-white/12 text-white"
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  Notifications Center
                </Link>
              </li>
            ) : null}
            {showCustomer ? (
              <NavAccordion
                title="My Portal"
                open={customerOpen}
                onToggle={() => setCustomerOpen((o) => !o)}
                active={myDashboardActive}
                controlsId="customer-nav-submenu"
                links={customerLinks}
                pathname={pathname}
              />
            ) : null}
            {showAttendee ? (
              <NavAccordion
                title="My Event"
                open={attendeeOpen}
                onToggle={() => setAttendeeOpen((o) => !o)}
                active={attendeeActive}
                controlsId="attendee-nav-submenu"
                links={attendeeLinks}
                pathname={pathname}
              />
            ) : null}
            {showEvents ? (
              <NavAccordion
                title="Event Operations"
                open={eventsOpen}
                onToggle={() => setEventsOpen((o) => !o)}
                active={eventsActive}
                controlsId="events-nav-submenu"
                links={roleNav.events}
                pathname={pathname}
              />
            ) : null}
            {showVendor ? (
              <NavAccordion
                title="Layouts"
                open={vendorOpen}
                onToggle={() => setVendorOpen((o) => !o)}
                active={vendorActive}
                controlsId="vendor-nav-submenu"
                links={vendorLinks}
                pathname={pathname}
              />
            ) : null}
            {showContracts ? (
              <NavAccordion
                title="Contracts & Engagements"
                open={contractsOpen}
                onToggle={() => setContractsOpen((o) => !o)}
                active={contractsActive}
                controlsId="contracts-nav-submenu"
                links={roleNav.contracts}
                pathname={pathname}
              />
            ) : null}
            {showApprovals ? (
              <li>
                <Link
                  href="/approvals"
                  className={`block rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    pathname === "/approvals" || pathname.startsWith("/approvals/")
                      ? "bg-white/12 text-white"
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  Approvals
                </Link>
              </li>
            ) : null}
            {showWork ? (
              <NavAccordion
                title="Progress Tracker"
                open={workOpen}
                onToggle={() => setWorkOpen((o) => !o)}
                active={workActive}
                controlsId="work-nav-submenu"
                links={workLinks}
                pathname={pathname}
              />
            ) : null}
            {showBilling ? (
              <NavAccordion
                title="Billing & A/R"
                open={billingOpen}
                onToggle={() => setBillingOpen((o) => !o)}
                active={billingActive}
                controlsId="billing-nav-submenu"
                links={roleNav.billing}
                pathname={pathname}
                badge={alertCount}
              />
            ) : null}
            {showCosts ? (
              <NavAccordion
                title="Costs & Resources"
                open={costsOpen}
                onToggle={() => setCostsOpen((o) => !o)}
                active={costsActive}
                controlsId="costs-nav-submenu"
                links={roleNav.costs}
                pathname={pathname}
              />
            ) : null}
            {showAnalyticsCenter ? (
              <NavAccordion
                title="Analytics Center"
                open={analyticsOpen}
                onToggle={() => setAnalyticsOpen((o) => !o)}
                active={analyticsCenterActive}
                controlsId="analytics-nav-submenu"
                links={analyticsCenterLinks}
                pathname={pathname}
              />
            ) : null}
            {showCompliance ? (
              <NavAccordion
                title="GAAP Compliance"
                open={complianceOpen}
                onToggle={() => setComplianceOpen((o) => !o)}
                active={complianceActive}
                controlsId="compliance-nav-submenu"
                links={complianceLinks}
                pathname={pathname}
              />
            ) : null}
            {showUsers ? (
              <NavAccordion
                title="Users & Roles"
                open={usersOpen}
                onToggle={() => setUsersOpen((o) => !o)}
                active={usersActive}
                controlsId="users-nav-submenu"
                links={roleNav.users}
                pathname={pathname}
              />
            ) : null}
            {homeOnly ? (
              <li className="px-3 py-2 text-xs text-white/40">
                Portal view — limited navigation for your role.
              </li>
            ) : null}
          </ul>
        </nav>

        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <p className="text-sm font-medium text-white">{session.fullName}</p>
          <p className="text-xs text-white/50">{session.roleName}</p>
          <p className="truncate text-xs text-white/35">{session.email}</p>
          <DemoRoleSwitcher currentEmail={session.email} />
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => logoutAction())}
            className="mt-3 w-full rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            {pending ? "Signing Out…" : "Sign Out"}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--line)] bg-[var(--surface)] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                {session.roleName} · MainEvent
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Integrated Contract-to-Cash — role drives what you can open
              </p>
            </div>
          </div>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
      {showBilling || showCompliance || showCosts || showAnalyticsCenter ? (
        <AssistantChat />
      ) : null}
    </div>
  );
}
