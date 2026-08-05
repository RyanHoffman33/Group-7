"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AssistantChat } from "@/components/assistant/AssistantChat";

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

const profitabilityLinks = [
  { href: "/profitability", label: "Portfolio overview" },
  { href: "/profitability/exceptions", label: "Exceptions" },
];

const teamModules = [
  { label: "Users & Roles", owner: "Brandon" },
  { label: "Contracts & Engagements", owner: "Gabriel" },
  { label: "Work & Performance", owner: "Jacob" },
  { label: "Cost & Resources", owner: "Walker" },
  { label: "Dashboards", owner: "Grayson" },
  { label: "Controls", owner: "Carson" },
];

function isBillingRoute(pathname: string) {
  return pathname === "/billing" || pathname.startsWith("/billing/");
}

function isComplianceRoute(pathname: string) {
  return pathname === "/compliance" || pathname.startsWith("/compliance/");
}

function isProfitabilityRoute(pathname: string) {
  return pathname === "/profitability" || pathname.startsWith("/profitability/");
}

function isLinkActive(pathname: string, href: string) {
  if (href === "/billing" || href === "/compliance" || href === "/profitability")
    return pathname === href;
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
  const billingActive = isBillingRoute(pathname);
  const complianceActive = isComplianceRoute(pathname);
  const profitabilityActive = isProfitabilityRoute(pathname);
  const [billingOpen, setBillingOpen] = useState(billingActive);
  const [complianceOpen, setComplianceOpen] = useState(complianceActive);
  const [profitabilityOpen, setProfitabilityOpen] = useState(profitabilityActive);

  useEffect(() => {
    if (billingActive) setBillingOpen(true);
  }, [billingActive]);

  useEffect(() => {
    if (complianceActive) setComplianceOpen(true);
  }, [complianceActive]);

  useEffect(() => {
    if (profitabilityActive) setProfitabilityOpen(true);
  }, [profitabilityActive]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
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
            Contract to Cash
          </p>
        </div>

        <nav className="px-3 pb-4" aria-label="Primary">
          <ul className="space-y-1">
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
            <NavAccordion
              title="GAAP Compliance"
              open={complianceOpen}
              onToggle={() => setComplianceOpen((o) => !o)}
              active={complianceActive}
              controlsId="compliance-nav-submenu"
              links={complianceLinks}
              pathname={pathname}
            />
            <NavAccordion
              title="Profitability"
              open={profitabilityOpen}
              onToggle={() => setProfitabilityOpen((o) => !o)}
              active={profitabilityActive}
              controlsId="profitability-nav-submenu"
              links={profitabilityLinks}
              pathname={pathname}
            />
          </ul>
        </nav>

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
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--line)] bg-[var(--surface)] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                GAAP · Contract-to-Cash
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Deposits as liabilities · Revenue on performance · Auditable A/R
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
