"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AssistantChat } from "@/components/assistant/AssistantChat";

const contractsLinks = [
  { href: "/contracts", label: "Contracts Dashboard" },
  { href: "/contracts/list", label: "All Contracts" },
  { href: "/contracts/new", label: "Create Contract" },
  { href: "/contracts/approvals", label: "Approvals" },
  { href: "/contracts/change-orders", label: "Change Orders" },
  { href: "/contracts/closeout", label: "Contract Closeout" },
];

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

const workLinks = [
  { href: "/work", label: "Event board" },
  { href: "/work/exceptions", label: "Exception inbox" },
];

const costsLinks = [
  { href: "/costs", label: "Cost dashboard" },
  { href: "/costs/time", label: "Time entry" },
  { href: "/costs/expenses", label: "Vendor & expenses" },
  { href: "/costs/commitments", label: "Commitments" },
  { href: "/costs/approvals", label: "Approval queue" },
  { href: "/costs/flags", label: "Flags & exceptions" },
  { href: "/costs/reports", label: "Reports / export" },
];

const profitabilityLinks = [
  { href: "/profitability", label: "Portfolio overview" },
  { href: "/profitability/exceptions", label: "Exceptions" },
];

const dashboardLinks = [
  { href: "/dashboard", label: "Manager Dashboard" },
  { href: "/dashboard/employee", label: "Employee Dashboard" },
  { href: "/dashboard/accounting", label: "Accounting Dashboard" },
  { href: "/dashboard/customer", label: "Customer Dashboard" },
];

const usersLinks = [
  { href: "/users", label: "Overview" },
  { href: "/users/directory", label: "Directory" },
  { href: "/users/roles", label: "Roles" },
  { href: "/users/permissions", label: "Permissions" },
  { href: "/users/assignments", label: "Assignments" },
  { href: "/users/audit", label: "Access audit" },
];

const teamModules = [
  { label: "Controls", owner: "Carson" },
];

const ROOT_HREFS = new Set([
  "/billing",
  "/compliance",
  "/contracts",
  "/work",
  "/costs",
  "/profitability",
  "/dashboard",
  "/users",
]);

function routeActive(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function isLinkActive(pathname: string, href: string) {
  if (ROOT_HREFS.has(href)) return pathname === href;
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
            : "text-white/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge && badge > 0 ? (
            <span className="rounded-full bg-[#f0c14a] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--ink)]">
              {badge}
            </span>
          ) : null}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-white/55 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div
        id={controlsId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <ul
          className="mt-1 min-h-0 space-y-0.5 overflow-hidden border-l border-white/10 pl-2 ml-3"
          aria-hidden={!open}
        >
          {links.map((link) => {
            const linkActive = isLinkActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                    linkActive
                      ? "bg-white/15 text-white"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{link.label}</span>
                  {link.href === "/billing/alerts" && badge && badge > 0 ? (
                    <span className="rounded-full bg-[#f0c14a] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)]">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

export function AppShell({
  children,
  alertCount = 0,
}: {
  children: React.ReactNode;
  alertCount?: number;
}) {
  const pathname = usePathname();
  const contractsActive = routeActive(pathname, "/contracts");
  const billingActive = routeActive(pathname, "/billing");
  const complianceActive = routeActive(pathname, "/compliance");
  const workActive = routeActive(pathname, "/work");
  const costsActive = routeActive(pathname, "/costs");
  const profitabilityActive = routeActive(pathname, "/profitability");
  const dashboardActive = routeActive(pathname, "/dashboard");
  const usersActive = routeActive(pathname, "/users");

  const [contractsPinned, setContractsPinned] = useState(false);
  const [billingPinned, setBillingPinned] = useState(false);
  const [compliancePinned, setCompliancePinned] = useState(false);
  const [workPinned, setWorkPinned] = useState(false);
  const [costsPinned, setCostsPinned] = useState(false);
  const [profitabilityPinned, setProfitabilityPinned] = useState(false);
  const [dashboardPinned, setDashboardPinned] = useState(false);
  const [usersPinned, setUsersPinned] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-[var(--line)] bg-[var(--ink)] text-white lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="px-5 pb-4 pt-7">
          <Link
            href="/billing"
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
            Contract to Cash · Integration
          </p>
        </div>

        <nav className="max-h-[calc(100vh-10rem)] overflow-y-auto px-3 pb-4" aria-label="Primary">
          <ul className="space-y-1">
            <NavAccordion
              title="Contracts & Engagements"
              open={contractsActive || contractsPinned}
              onToggle={() => {
                if (contractsActive) return;
                setContractsPinned((p) => !p);
              }}
              active={contractsActive}
              controlsId="contracts-nav-submenu"
              links={contractsLinks}
              pathname={pathname}
            />
            <NavAccordion
              title="Billing & A/R"
              open={billingActive || billingPinned}
              onToggle={() => {
                if (billingActive) return;
                setBillingPinned((p) => !p);
              }}
              active={billingActive}
              controlsId="billing-nav-submenu"
              links={billingLinks}
              pathname={pathname}
              badge={alertCount}
            />
            <NavAccordion
              title="GAAP Compliance"
              open={complianceActive || compliancePinned}
              onToggle={() => {
                if (complianceActive) return;
                setCompliancePinned((p) => !p);
              }}
              active={complianceActive}
              controlsId="compliance-nav-submenu"
              links={complianceLinks}
              pathname={pathname}
            />
            <NavAccordion
              title="Work & Performance"
              open={workActive || workPinned}
              onToggle={() => {
                if (workActive) return;
                setWorkPinned((p) => !p);
              }}
              active={workActive}
              controlsId="work-nav-submenu"
              links={workLinks}
              pathname={pathname}
            />
            <NavAccordion
              title="Cost & Resources"
              open={costsActive || costsPinned}
              onToggle={() => {
                if (costsActive) return;
                setCostsPinned((p) => !p);
              }}
              active={costsActive}
              controlsId="costs-nav-submenu"
              links={costsLinks}
              pathname={pathname}
            />
            <NavAccordion
              title="Profitability"
              open={profitabilityActive || profitabilityPinned}
              onToggle={() => {
                if (profitabilityActive) return;
                setProfitabilityPinned((p) => !p);
              }}
              active={profitabilityActive}
              controlsId="profitability-nav-submenu"
              links={profitabilityLinks}
              pathname={pathname}
            />
            <NavAccordion
              title="Dashboards"
              open={dashboardActive || dashboardPinned}
              onToggle={() => {
                if (dashboardActive) return;
                setDashboardPinned((p) => !p);
              }}
              active={dashboardActive}
              controlsId="dashboard-nav-submenu"
              links={dashboardLinks}
              pathname={pathname}
            />
            <NavAccordion
              title="Users & Roles"
              open={usersActive || usersPinned}
              onToggle={() => {
                if (usersActive) return;
                setUsersPinned((p) => !p);
              }}
              active={usersActive}
              controlsId="users-nav-submenu"
              links={usersLinks}
              pathname={pathname}
            />
          </ul>
        </nav>

        <div className="mt-2 border-t border-white/10 px-3 py-4">
          <p className="px-2 pb-2 text-[11px] uppercase tracking-wider text-white/40">
            Still pending
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
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--line)] bg-[var(--surface)] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                MainEvent · Integrated build
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Contracts · Billing · Compliance · Work · Costs · Profitability · Dashboards · Users
              </p>
            </div>
          </div>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
      <AssistantChat />
    </div>
  );
}
