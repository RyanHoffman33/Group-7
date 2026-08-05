"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { logoutAction } from "@/features/users/actions";
import type { AppRole } from "@/features/users/types";
import type { NavSection } from "@/features/users/role-nav";

const billingLinks = [
  { href: "/billing", label: "A/R Dashboard" },
  { href: "/billing/determine", label: "Determine charges" },
  { href: "/billing/invoices", label: "Invoices" },
  { href: "/billing/payments", label: "Payments" },
  { href: "/billing/deposits", label: "Deposits" },
  { href: "/billing/recurring", label: "Recurring & drafts" },
  { href: "/billing/aging", label: "Aging & Collections" },
  { href: "/billing/alerts", label: "Billing Alerts" },
];

const complianceLinks = [
  { href: "/compliance", label: "Contract position" },
  { href: "/compliance/recognition", label: "Recognition" },
  { href: "/compliance/deposits-retainers", label: "Deposits & retainers" },
  { href: "/compliance/modifications", label: "Modifications" },
  { href: "/compliance/costs", label: "Cost classification" },
  { href: "/compliance/audit", label: "Audit pack" },
  { href: "/compliance/policies", label: "Policies" },
];

const usersLinks = [
  { href: "/users", label: "Overview" },
  { href: "/users/directory", label: "Directory" },
  { href: "/users/roles", label: "Roles" },
  { href: "/users/permissions", label: "Permissions" },
  { href: "/users/assignments", label: "Assignments" },
  { href: "/users/audit", label: "Access audit" },
];

const eventsLinks = [
  { href: "/events", label: "All events" },
  { href: "/events/evt-ops-1", label: "NovaTech Launch" },
  { href: "/events/evt-ops-1/features", label: "Feature hub" },
  { href: "/events/evt-ops-1/schedule", label: "Schedule" },
  { href: "/events/evt-ops-1/qr", label: "QR & Check-in" },
  { href: "/events/evt-ops-1/emails", label: "Emails" },
  { href: "/events/evt-ops-1/speakers", label: "Speakers" },
  { href: "/events/evt-ops-1/agenda", label: "Agenda" },
];

const vendorLinks = [
  { href: "/vendor", label: "Assignments" },
  { href: "/vendor/layouts/lay-1", label: "Theater layout" },
  { href: "/vendor/layouts/lay-2", label: "Banquet layout" },
];

const attendeeLinks = [
  { href: "/attendee", label: "My event" },
  { href: "/attendee/survey", label: "Survey" },
];

const teamModules = [
  { label: "Contracts & Engagements", owner: "Gabriel" },
  { label: "Work & Performance", owner: "Jacob" },
  { label: "Cost & Resources", owner: "Walker" },
  { label: "Profitability", owner: "Joseph" },
  { label: "Dashboards", owner: "Grayson" },
  { label: "Controls", owner: "Carson" },
];

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

function isLinkActive(pathname: string, href: string) {
  if (
    href === "/billing" ||
    href === "/compliance" ||
    href === "/users" ||
    href === "/events" ||
    href === "/attendee" ||
    href === "/vendor" ||
    href === "/home"
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
          <span className="text-white/40">{open ? "−" : "+"}</span>
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
  const showUsers = navSections.includes("users");
  const showBilling = navSections.includes("billing");
  const showCompliance = navSections.includes("compliance");
  const showEvents = navSections.includes("events");
  const showAttendee = navSections.includes("attendee");
  const showVendor = navSections.includes("vendor");
  const showApprovals = navSections.includes("approvals");
  const homeOnly =
    navSections.includes("home_only") &&
    !showBilling &&
    !showCompliance &&
    !showUsers &&
    !showEvents &&
    !showAttendee &&
    !showVendor &&
    !showApprovals;

  const [billingOpen, setBillingOpen] = useState(billingActive);
  const [complianceOpen, setComplianceOpen] = useState(complianceActive);
  const [usersOpen, setUsersOpen] = useState(usersActive);
  const [eventsOpen, setEventsOpen] = useState(eventsActive);
  const [attendeeOpen, setAttendeeOpen] = useState(attendeeActive);
  const [vendorOpen, setVendorOpen] = useState(vendorActive);
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

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-[var(--line)] bg-[var(--ink)] text-white lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="px-5 pb-4 pt-7">
          <Link
            href="/home"
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

        <nav className="px-3 pb-4" aria-label="Primary">
          <ul className="space-y-1">
            <li>
              <Link
                href={
                  session.roleKey === "attendee"
                    ? "/attendee"
                    : session.roleKey === "vendor"
                      ? "/vendor"
                      : "/home"
                }
                className={`block rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  pathname === "/home" ||
                  pathname === "/attendee" ||
                  pathname === "/vendor"
                    ? "bg-white/12 text-white"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                My dashboard
              </Link>
            </li>
            {showAttendee ? (
              <NavAccordion
                title="My event"
                open={attendeeOpen}
                onToggle={() => setAttendeeOpen((o) => !o)}
                active={attendeeActive}
                controlsId="attendee-nav-submenu"
                links={attendeeLinks}
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
                links={usersLinks}
                pathname={pathname}
              />
            ) : null}
            {showEvents ? (
              <NavAccordion
                title="Event operations"
                open={eventsOpen}
                onToggle={() => setEventsOpen((o) => !o)}
                active={eventsActive}
                controlsId="events-nav-submenu"
                links={eventsLinks}
                pathname={pathname}
              />
            ) : null}
            {showVendor ? (
              <NavAccordion
                title="Vendor work"
                open={vendorOpen}
                onToggle={() => setVendorOpen((o) => !o)}
                active={vendorActive}
                controlsId="vendor-nav-submenu"
                links={vendorLinks}
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
            {showBilling ? (
              <NavAccordion
                title="Billing & A/R"
                open={billingOpen}
                onToggle={() => setBillingOpen((o) => !o)}
                active={billingActive}
                controlsId="billing-nav-submenu"
                links={billingLinks}
                pathname={pathname}
                badge={alertCount}
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
            {homeOnly ? (
              <li className="px-3 py-2 text-xs text-white/40">
                Portal view — limited navigation for your role.
              </li>
            ) : null}
          </ul>
        </nav>

        {session.roleKey === "system_admin" || session.roleKey === "executive" ? (
          <div className="mt-2 border-t border-white/10 px-3 py-4">
            <p className="px-2 pb-2 text-[11px] uppercase tracking-wider text-white/40">
              Team modules (pending)
            </p>
            <ul className="space-y-1">
              {teamModules.map((m) => (
                <li
                  key={m.label}
                  className="rounded-md px-3 py-2 text-sm text-white/35"
                  title={`Owned by ${m.owner}`}
                >
                  {m.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <p className="text-sm font-medium text-white">{session.fullName}</p>
          <p className="text-xs text-white/50">{session.roleName}</p>
          <p className="truncate text-xs text-white/35">{session.email}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => logoutAction())}
            className="mt-3 w-full rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            {pending ? "Signing out…" : "Sign out"}
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
                Role-specific workspace — account drives the interface
              </p>
            </div>
          </div>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
      {showBilling || showCompliance ? <AssistantChat /> : null}
    </div>
  );
}
