"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

const teamModules = [
  { label: "Users & Roles", owner: "Brandon" },
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

function isLinkActive(pathname: string, href: string) {
  if (href === "/billing") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const [billingOpen, setBillingOpen] = useState(billingActive);

  useEffect(() => {
    if (billingActive) setBillingOpen(true);
  }, [billingActive]);

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
            <li>
              <button
                type="button"
                onClick={() => setBillingOpen((open) => !open)}
                aria-expanded={billingOpen}
                aria-controls="billing-nav-submenu"
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${
                  billingActive
                    ? "bg-white/12 text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  Billing & A/R
                  {alertCount > 0 ? (
                    <span className="rounded-full bg-[#f0c14a] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--ink)]">
                      {alertCount}
                    </span>
                  ) : null}
                </span>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-white/55 transition-transform duration-200 ${
                    billingOpen ? "rotate-180" : ""
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
                id="billing-nav-submenu"
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  billingOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <ul
                  className="mt-1 min-h-0 space-y-0.5 overflow-hidden border-l border-white/10 pl-2 ml-3"
                  aria-hidden={!billingOpen}
                >
                  {billingLinks.map((link) => {
                    const active = isLinkActive(pathname, link.href);
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                            active
                              ? "bg-white/15 text-white"
                              : "text-white/65 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>{link.label}</span>
                          {link.href === "/billing/alerts" && alertCount > 0 ? (
                            <span className="rounded-full bg-[#f0c14a] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)]">
                              {alertCount}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
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
    </div>
  );
}
