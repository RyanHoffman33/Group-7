import Link from "next/link";
import { Suspense } from "react";
import { listCustomers, listContracts, getContract } from "@/features/billing/adapters/upstream";
import { listInvoices } from "@/features/billing/queries";
import { formatDate, formatLabel } from "@/features/billing/aging";
import { CreateInvoiceForm } from "@/components/billing/CreateInvoiceForm";
import { InvoiceFilters } from "@/components/billing/InvoiceFilters";
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

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    contract_id?: string;
    contractId?: string;
    customer_id?: string;
    status?: string;
    recognition?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const contractFilter = sp.contract_id || sp.contractId || undefined;
  const customerFilter = sp.customer_id || undefined;
  const statusFilter =
    sp.status && sp.status !== "all" ? sp.status : undefined;
  const recognitionFilter =
    sp.recognition && sp.recognition !== "all" ? sp.recognition : undefined;
  const qFilter = sp.q?.trim() || undefined;

  const [invoices, customers, contracts, scopedContract] = await Promise.all([
    listInvoices({
      contractId: contractFilter,
      customerId: customerFilter,
      status: statusFilter,
      recognitionStatus: recognitionFilter,
      q: qFilter,
    }),
    listCustomers(),
    listContracts(),
    contractFilter ? getContract(contractFilter) : Promise.resolve(null),
  ]);

  const filterBits = [
    scopedContract
      ? scopedContract.contract_number ?? scopedContract.event_name
      : contractFilter
        ? "contract"
        : null,
    customerFilter
      ? customers.find((c) => c.id === customerFilter)?.name ?? "customer"
      : null,
    statusFilter ? formatLabel(statusFilter) : null,
    recognitionFilter ? formatLabel(recognitionFilter) : null,
    qFilter ? `“${qFilter}”` : null,
  ].filter(Boolean);

  const panelTitle =
    filterBits.length > 0
      ? `Invoices · ${filterBits.join(" · ")}`
      : "All invoices";

  const customerOptions = customers
    .map((c) => ({ id: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const contractOptions = contracts
    .map((c) => ({
      id: c.id,
      label: `${c.contract_number ? `${c.contract_number} · ` : ""}${c.event_name}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create and manage customer invoices. Filter by status, customer, contract, or recognition — or search by invoice number."
        actions={
          scopedContract ? (
            <Link
              href={`/contracts/${scopedContract.id}`}
              className="text-sm font-medium text-[var(--accent)]"
            >
              ← Contract workspace
            </Link>
          ) : undefined
        }
      />

      <Suspense fallback={null}>
        <InvoiceFilters
          customers={customerOptions}
          contracts={contractOptions}
        />
      </Suspense>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title={panelTitle}>
          <p className="mb-3 text-xs text-[var(--muted)]">
            Showing {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
          </p>
          {invoices.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No invoices match these filters.
            </p>
          ) : (
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
          )}
        </Panel>

        <Panel title="Issue invoice">
          <CreateInvoiceForm
            customers={customers.map((c) => ({ id: c.id, label: c.name }))}
            contracts={contracts.map((c) => ({
              id: c.id,
              label: `${c.contract_number ? `${c.contract_number} · ` : ""}${c.event_name}`,
              customer_id: c.customer_id,
            }))}
            defaultCustomerId={
              scopedContract?.customer_id ?? customerFilter ?? undefined
            }
            defaultContractId={scopedContract?.id ?? contractFilter}
          />
        </Panel>
      </div>
    </div>
  );
}
