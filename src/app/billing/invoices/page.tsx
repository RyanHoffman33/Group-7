import Link from "next/link";
import { listCustomers, listContracts } from "@/features/billing/adapters/upstream";
import { listInvoices } from "@/features/billing/queries";
import { formatDate, formatLabel } from "@/features/billing/aging";
import { CreateInvoiceForm } from "@/components/billing/CreateInvoiceForm";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

function invoiceTone(status: string) {
  if (status === "paid") return "ok" as const;
  if (status === "void" || status === "canceled") return "neutral" as const;
  if (status === "partially_paid") return "warn" as const;
  if (status === "disputed") return "danger" as const;
  if (status === "unpaid") return "accent" as const;
  return "neutral" as const;
}

function recogTone(status: string) {
  return status === "recognized" ? ("ok" as const) : ("warn" as const);
}

export default async function InvoicesPage() {
  const [invoices, customers, contracts] = await Promise.all([
    listInvoices(),
    listCustomers(),
    listContracts(),
  ]);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create and manage customer invoices. Use Determine charges for method-based billing. Track unpaid, partial, paid, disputed, canceled, and void."
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="All invoices">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">Customer / Event</th>
                  <th className="pb-2 font-medium">Due</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Recognition</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">
                      <Link
                        href={`/billing/invoices/${inv.id}`}
                        className="font-semibold text-[var(--accent)]"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="py-3">
                      <div>{inv.customer_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {inv.event_name}
                      </div>
                    </td>
                    <td className="py-3">{formatDate(inv.due_date)}</td>
                    <td className="py-3">
                      <Money amount={Number(inv.total)} />
                    </td>
                    <td className="py-3">
                      <StatusPill tone="neutral">
                        {formatLabel(inv.billing_method)}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      <StatusPill tone={invoiceTone(inv.status)}>
                        {formatLabel(inv.status)}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      <StatusPill tone={recogTone(inv.recognition_status)}>
                        {formatLabel(inv.recognition_status)}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Issue invoice">
          <CreateInvoiceForm
            customers={customers.map((c) => ({ id: c.id, label: c.name }))}
            contracts={contracts.map((c) => ({
              id: c.id,
              label: c.event_name,
              customer_id: c.customer_id,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
