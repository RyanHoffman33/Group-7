import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getApplicationsForInvoice,
  getInvoice,
  getInvoiceLines,
  getLedger,
  invoiceOutstanding,
  listDeposits,
} from "@/features/billing/queries";
import { getCustomer, getContract } from "@/features/billing/adapters/upstream";
import { formatDate, formatLabel } from "@/features/billing/aging";
import {
  ApplyDepositButton,
  InvoiceActions,
  PaymentForm,
} from "@/components/billing/Actions";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();

  const [lines, ledger, apps, outstanding, customer, contract, deposits] =
    await Promise.all([
      getInvoiceLines(id),
      getLedger(id),
      getApplicationsForInvoice(id),
      invoiceOutstanding(id),
      getCustomer(inv.customer_id),
      getContract(inv.contract_id),
      listDeposits(),
    ]);

  const unearned = deposits.filter(
    (d) =>
      d.status === "unearned" &&
      d.customer_id === inv.customer_id &&
      d.contract_id === inv.contract_id,
  );

  return (
    <div>
      <PageHeader
        title={inv.invoice_number}
        description={`${customer?.name ?? "Customer"} · ${contract?.event_name ?? "Event"}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/billing/invoices?contract_id=${inv.contract_id}`}
              className="text-sm text-[var(--accent)]"
            >
              ← Contract invoices
            </Link>
            {contract ? (
              <Link
                href={`/contracts/${inv.contract_id}`}
                className="text-sm text-[var(--accent)]"
              >
                Contract workspace
              </Link>
            ) : null}
            <Link
              href="/billing/invoices"
              className="text-sm text-[var(--accent)]"
            >
              All invoices
            </Link>
            <InvoiceActions
              invoiceId={inv.id}
              canRecognize={
                inv.recognition_status === "deferred" &&
                inv.status !== "void" &&
                inv.status !== "draft" &&
                inv.status !== "canceled"
              }
              canVoid={
                inv.status !== "void" &&
                inv.status !== "paid" &&
                inv.status !== "canceled"
              }
              canDispute={["unpaid", "partially_paid"].includes(inv.status)}
              canResolveDispute={inv.status === "disputed"}
              canCancel={!["canceled", "void", "paid"].includes(inv.status)}
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusPill
          tone={
            inv.status === "paid"
              ? "ok"
              : inv.status === "disputed"
                ? "danger"
                : inv.status === "partially_paid"
                  ? "warn"
                  : "accent"
          }
        >
          {formatLabel(inv.status)}
        </StatusPill>
        <StatusPill
          tone={inv.recognition_status === "recognized" ? "ok" : "warn"}
        >
          {formatLabel(inv.recognition_status)}
        </StatusPill>
        {inv.billing_method ? (
          <StatusPill tone="neutral">
            {formatLabel(inv.billing_method)}
          </StatusPill>
        ) : null}
        <StatusPill tone="neutral">
          Outstanding <Money amount={outstanding} />
        </StatusPill>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Invoice summary">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Issue date</dt>
              <dd>{formatDate(inv.issue_date)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Due date</dt>
              <dd>{formatDate(inv.due_date)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Subtotal</dt>
              <dd>
                <Money amount={Number(inv.subtotal)} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Tax</dt>
              <dd>
                <Money amount={Number(inv.tax)} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Total</dt>
              <dd className="font-semibold">
                <Money amount={Number(inv.total)} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Milestone</dt>
              <dd>{inv.milestone_key ?? "—"}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span>
                  {l.description}
                  {l.performance_obligation_ref ? (
                    <span className="block text-xs text-[var(--muted)]">
                      {l.performance_obligation_ref}
                    </span>
                  ) : null}
                </span>
                <Money amount={Number(l.amount)} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Record payment">
          {outstanding > 0 &&
          inv.status !== "void" &&
          inv.status !== "canceled" ? (
            <PaymentForm
              customerId={inv.customer_id}
              invoiceId={inv.id}
              maxApply={outstanding}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No open balance to collect.
            </p>
          )}
        </Panel>

        <Panel title="Payment applications">
          {apps.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No payments applied.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {apps.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>
                    {formatDate(a.payment?.paid_at ?? a.created_at)} ·{" "}
                    {a.payment?.method ?? "payment"}
                    {a.payment?.reference ? ` · ${a.payment.reference}` : ""}
                  </span>
                  <Money amount={Number(a.amount)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="A/R ledger (audit)">
          {ledger.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No ledger entries.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {ledger.map((e) => (
                <li key={e.id} className="border-b border-[var(--line)] pb-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{e.entry_type}</span>
                    <span>
                      Dr <Money amount={Number(e.debit)} /> / Cr{" "}
                      <Money amount={Number(e.credit)} />
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{e.memo}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {unearned.length > 0 && outstanding > 0 ? (
          <Panel title="Apply unearned deposit">
            <ul className="space-y-3 text-sm">
              {unearned.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    <Money amount={Number(d.amount)} /> received{" "}
                    {formatDate(d.received_at)}
                  </span>
                  <ApplyDepositButton depositId={d.id} invoiceId={inv.id} />
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
