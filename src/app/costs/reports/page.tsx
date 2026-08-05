import Link from "next/link";
import { Suspense } from "react";
import { formatDate } from "@/features/billing/aging";
import {
  COST_CATEGORIES,
  categoryLabel,
} from "@/features/costs/config";
import {
  listContractsForCosts,
  listCostsForReport,
} from "@/features/costs/queries";
import { ExportCsvButton } from "@/components/costs/ExportCsvButton";
import { ReportFilters } from "@/components/costs/ReportFilters";
import {
  Money,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function CostsReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    contractId?: string;
    category?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const [contracts, rows] = await Promise.all([
    listContractsForCosts(),
    listCostsForReport({
      contractId: sp.contractId || undefined,
      category: sp.category || undefined,
      dateFrom: sp.from || undefined,
      dateTo: sp.to || undefined,
    }),
  ]);

  const csvRows = rows.map((e) => ({
    date: e.incurred_date,
    event: e.event_name ?? "",
    customer: e.customer_name ?? "",
    category: categoryLabel(e.category),
    entry_type: e.entry_type,
    amount: e.amount,
    commitment_status: e.commitment_status,
    approval_status: e.approval_status,
    vendor: e.vendor_name ?? "",
    invoice_ref: e.invoice_ref ?? "",
    entered_by: e.entered_by,
    notes: e.notes ?? "",
  }));

  return (
    <div>
      <PageHeader
        title="Reports / export"
        description="Filter costs by event, category, and date range."
        actions={<ExportCsvButton rows={csvRows} />}
      />

      <Panel title="Filters">
        <Suspense fallback={null}>
          <ReportFilters
            contracts={contracts.map((c) => ({
              id: c.id,
              event_name: c.event_name,
            }))}
            categories={[...COST_CATEGORIES]}
          />
        </Suspense>
      </Panel>

      <div className="mt-4">
        <Panel title={`${rows.length} result(s)`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">{formatDate(e.incurred_date)}</td>
                    <td className="py-3">
                      <p>{e.event_name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {e.customer_name}
                      </p>
                    </td>
                    <td className="py-3">
                      <StatusPill>{categoryLabel(e.category)}</StatusPill>
                    </td>
                    <td className="py-3">
                      <Money amount={e.amount} />
                    </td>
                    <td className="py-3 text-xs text-[var(--muted)]">
                      {e.commitment_status} · {e.approval_status}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/costs/entries/${e.id}`}
                        className="text-sm font-semibold text-[var(--accent)]"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-sm text-[var(--muted)]"
                    >
                      No costs match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
