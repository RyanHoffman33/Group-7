"use client";

import { formatDate } from "@/features/billing/aging";
import { Money, Panel, StatusPill } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";
import Link from "next/link";

export function CustomerPaymentsPage() {
  const { payments, financial } = useCustomerPortal();

  const depositTone =
    financial.depositStatus === "satisfied"
      ? "ok"
      : financial.depositStatus === "partial"
        ? "warn"
        : financial.depositStatus === "due"
          ? "danger"
          : "neutral";

  return (
    <div className="flex flex-col gap-3">
      <Panel title="How your payments break down" bodyClassName="px-4 py-4">
        <p className="mb-3 text-[13px] text-[var(--muted)]">
          Deposits are held as a liability until MainEvent bills production
          milestones. Progress invoices are amounts earned as your event moves
          forward.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Deposit
              </p>
              <StatusPill tone={depositTone}>
                {financial.depositStatus === "satisfied"
                  ? "Satisfied"
                  : financial.depositStatus === "partial"
                    ? "Partial"
                    : financial.depositStatus === "due"
                      ? "Due"
                      : "N/A"}
              </StatusPill>
            </div>
            <p className="text-lg font-semibold tabular-nums">
              <Money amount={financial.depositPaid} />
            </p>
            <p className="text-[12px] text-[var(--muted)]">
              of <Money amount={financial.depositBilled} /> billed
              {financial.depositRemaining > 0.01
                ? ` · ${financial.depositRemaining.toLocaleString()} remaining`
                : ""}
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Progress / milestones
            </p>
            <p className="text-lg font-semibold tabular-nums">
              <Money amount={financial.progressPaid} />
            </p>
            <p className="text-[12px] text-[var(--muted)]">
              of <Money amount={financial.progressBilled} /> billed
              {financial.progressRemaining > 0.01
                ? ` · ${financial.progressRemaining.toLocaleString()} remaining`
                : ""}
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Remaining balance
            </p>
            <p className="text-lg font-semibold tabular-nums text-[#d97706]">
              <Money amount={financial.outstandingBalance} />
            </p>
            <p className="text-[12px] text-[var(--muted)]">
              Paid to date <Money amount={financial.amountPaid} />
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-3">
        <Panel compact title="Paid to date" bodyClassName="px-3 py-3">
          <p className="text-2xl font-semibold tabular-nums text-[#2f9a57]">
            <Money amount={financial.amountPaid} />
          </p>
        </Panel>
        <Panel compact title="Remaining balance" bodyClassName="px-3 py-3">
          <p className="text-2xl font-semibold tabular-nums text-[#d97706]">
            <Money amount={financial.outstandingBalance} />
          </p>
        </Panel>
        <Panel compact title="Need to pay?" bodyClassName="px-3 py-3">
          {financial.outstandingBalance > 0 ? (
            <Link
              href="/dashboard/customer/invoices"
              className="inline-flex rounded-md bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-white hover:opacity-95"
            >
              Go to invoices
            </Link>
          ) : (
            <p className="text-sm text-[#2f9a57]">All caught up.</p>
          )}
        </Panel>
      </div>

      <Panel title="Payment history" bodyClassName="px-0 py-0">
        {payments.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--muted)]">No payments yet.</p>
        ) : (
          <ul>
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--ink)]">{p.invoiceOrEvent}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                    {formatDate(p.paidAt)} · {p.method} · {p.reference} ·{" "}
                    {p.status}
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#2f9a57]">
                  <Money amount={p.amount} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
