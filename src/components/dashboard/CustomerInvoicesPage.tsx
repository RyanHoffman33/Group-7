"use client";

import { useState } from "react";
import { formatDate } from "@/features/billing/aging";
import { Money, Panel, StatusPill } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";
import {
  ModalShell,
  PayMethodPicker,
  invoiceLabel,
  invoiceTone,
  usePayMethod,
} from "@/components/dashboard/customer-ui";
import type { CustomerInvoice } from "@/features/dashboard/customer-sample";

export function CustomerInvoicesPage() {
  const { eventInvoices, recordPayment } = useCustomerPortal();
  const [viewing, setViewing] = useState<CustomerInvoice | null>(null);
  const [paying, setPaying] = useState<CustomerInvoice | null>(null);
  const [method, setMethod] = usePayMethod();

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Invoices"
        bodyClassName="overflow-x-auto px-0 py-0"
      >
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead className="border-b border-[var(--line)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Issued</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium text-right">Balance</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {eventInvoices.map((inv) => (
              <tr key={inv.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setViewing(inv)}
                    className="font-semibold text-[var(--accent)] hover:underline"
                  >
                    {inv.invoiceNumber}
                  </button>
                  <p className="text-[12px] text-[var(--muted)]">{inv.description}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                  {formatDate(inv.issueDate)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                  {formatDate(inv.dueDate)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  <Money amount={inv.amount} />
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  <Money amount={inv.balance} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill compact tone={invoiceTone(inv.status)}>
                    {invoiceLabel(inv.status)}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-right">
                  {inv.balance > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPaying(inv)}
                      className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[#f7f9fb]"
                    >
                      Pay
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setViewing(inv)}
                      className="text-[12px] font-medium text-[var(--accent)] hover:underline"
                    >
                      View
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {viewing ? (
        <ModalShell title={viewing.invoiceNumber} onClose={() => setViewing(null)}>
          <p className="text-sm text-[var(--muted)]">{viewing.description}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-[11px] text-[var(--muted)]">Issued</dt>
              <dd className="font-medium">{formatDate(viewing.issueDate)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[var(--muted)]">Due</dt>
              <dd className="font-medium">{formatDate(viewing.dueDate)}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-2 border-t border-[var(--line)] pt-3 text-sm">
            {viewing.lineItems.map((li) => (
              <li key={li.label} className="flex justify-between gap-2">
                <span className="text-[var(--muted)]">{li.label}</span>
                <span className="font-semibold tabular-nums">
                  <Money amount={li.amount} />
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-2 border-t border-[var(--line)] pt-2 font-semibold">
              <span>Balance due</span>
              <Money amount={viewing.balance} />
            </li>
          </ul>
          {viewing.balance > 0 ? (
            <button
              type="button"
              onClick={() => {
                setPaying(viewing);
                setViewing(null);
              }}
              className="mt-4 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Pay this invoice
            </button>
          ) : (
            <p className="mt-4 text-sm text-[#2f9a57]">Paid in full.</p>
          )}
        </ModalShell>
      ) : null}

      {paying ? (
        <ModalShell title={`Pay ${paying.invoiceNumber}`} onClose={() => setPaying(null)}>
          <p className="text-sm text-[var(--muted)]">
            Record a demo payment of{" "}
            <strong className="text-[var(--ink)]">
              <Money amount={paying.balance} />
            </strong>{" "}
            toward {paying.description}.
          </p>
          <div className="mt-4">
            <PayMethodPicker method={method} setMethod={setMethod} />
          </div>
          <button
            type="button"
            onClick={() => {
              recordPayment(paying.id, method);
              setPaying(null);
            }}
            className="mt-5 w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
          >
            Confirm payment
          </button>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Demo only — updates portal balances, no real bank charge.
          </p>
        </ModalShell>
      ) : null}
    </div>
  );
}
