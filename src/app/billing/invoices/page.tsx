import Link from "next/link";
import { listCustomers, listContracts, getContract } from "@/features/billing/adapters/upstream";
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

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ contract_id?: string; contractId?: string }>;
}) {
  const sp = await searchParams;
  const contractFilter = sp.contract_id || sp.contractId || undefined;

  const [invoices, customers, contracts, scopedContract] = await Promise.all([
    listInvoices(contractFilter ? { contractId: contractFilter } : undefined),
    listCustomers(),
    listContracts(),
    contractFilter ? getContract(contractFilter) : Promise.resolve(null),
  ]);

  const panelTitle = scopedContract
    ? `Invoices for ${scopedContract.contract_number ?? scopedContract.event_name}`
    : contractFilter
      ? "Invoices for contract"
      : "All invoices";

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={
          scopedContract
            ? `Filtered to ${scopedContract.event_name}. Clear the filter to see all invoices.`
            : "Create and manage customer invoices. Use Determine charges for method-based billing. Track unpaid, partial, paid, disputed, canceled, and void."
        }
        actions={
          contractFilter ? (
            <div className="flex flex-wrap items-center gap-3">
              {scopedContract ? (
                <Link
                  href={`/contracts/${scopedContract.id}`}
                  className="text-sm font-medium text-[var(--accent)]"
                >
                  ← Contract workspace
                </Link>
              ) : null}
              <Link
                href="/billing/invoices"
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-semibold"
              >
                Clear contract filter
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title={panelTitle}>
          {invoices.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No invoices{contractFilter ? " for this contract" : ""}.
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
            defaultCustomerId={scopedContract?.customer_id}
            defaultContractId={scopedContract?.id}
          />
        </Panel>
      </div>
    </div>
  );
}
