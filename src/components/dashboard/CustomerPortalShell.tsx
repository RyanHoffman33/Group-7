"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SAMPLE_CUSTOMER_EVENTS } from "@/features/dashboard/customer-sample";
import { PageHeader } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";

const NAV = [
  { href: "/dashboard/customer", label: "Overview", exact: true },
  { href: "/dashboard/customer/event", label: "Event Details" },
  { href: "/dashboard/customer/actions", label: "Action Items" },
  { href: "/dashboard/customer/invoices", label: "Invoices" },
  { href: "/dashboard/customer/payments", label: "Payments" },
  { href: "/dashboard/customer/documents", label: "Documents" },
] as const;

export function CustomerPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    fullName,
    organization,
    selectedId,
    setSelectedId,
    flash,
    pendingCount,
    financial,
  } = useCustomerPortal();

  const firstName = fullName.split(" ")[0] || fullName;
  const greeting = organization
    ? `Welcome, ${firstName} (${organization}).`
    : `Welcome, ${firstName}.`;

  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col gap-3">
      <PageHeader
        compact
        title="Your Event Portal"
        description={`${greeting} Open each section below to review and take action.`}
      />

      {flash ? (
        <div
          className="rounded-md border border-[#b7e4c7] bg-[#e6f6ec] px-3 py-2 text-sm text-[#1b6b3a]"
          role="status"
        >
          {flash}
        </div>
      ) : null}

      {SAMPLE_CUSTOMER_EVENTS.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_CUSTOMER_EVENTS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${
                e.id === selectedId
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[#f7f9fb]"
              }`}
            >
              {e.eventName}
            </button>
          ))}
        </div>
      ) : null}

      <nav
        aria-label="Customer portal sections"
        className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]"
      >
        <ul className="flex min-w-max gap-0.5 p-1">
          {NAV.map((item) => {
            const exact = "exact" in item && item.exact;
            const active = exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                  {item.href.endsWith("/actions") && pendingCount > 0 ? (
                    <span className="ml-1.5 rounded-full bg-[#d97706] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {pendingCount}
                    </span>
                  ) : null}
                  {item.href.endsWith("/invoices") && financial.outstandingBalance > 0 ? (
                    <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Due
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}
    </div>
  );
}
