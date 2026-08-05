import Link from "next/link";
import { listPayments } from "@/features/billing/queries";
import { formatDate } from "@/features/billing/aging";
import { Money, PageHeader, Panel } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const payments = await listPayments();

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Cash receipts. Apply payments from an invoice detail page to keep applications auditable."
        actions={
          <Link
            href="/billing/invoices"
            className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold"
          >
            Open invoices to apply
          </Link>
        }
      />

      <Panel title="Payment register">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 font-medium">Reference</th>
                <th className="pb-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="py-3">{formatDate(p.paid_at)}</td>
                  <td className="py-3">{p.customer_name}</td>
                  <td className="py-3">{p.method}</td>
                  <td className="py-3 text-[var(--muted)]">
                    {p.reference ?? "—"}
                  </td>
                  <td className="py-3 font-medium">
                    <Money amount={Number(p.amount)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
