import Link from "next/link";
import { formatDate, formatLabel } from "@/features/billing/aging";
import { listContractsForGaap } from "@/features/gaap/adapters/contracts";
import {
  listDeferredInvoices,
  listRecognitionEvidence,
} from "@/features/gaap/queries";
import { listRecentPoApprovals } from "@/features/performance-obligations";
import { EvidenceForm } from "@/components/gaap/Actions";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function RecognitionPage() {
  const [evidence, deferred, contracts, poApprovals] = await Promise.all([
    listRecognitionEvidence(),
    listDeferredInvoices(),
    listContractsForGaap(),
    listRecentPoApprovals(15),
  ]);

  return (
    <div>
      <PageHeader
        title="Revenue recognition"
        description="Revenue posts only when performance is satisfied and recognition evidence is on file. Cash alone is not earning. ASC 606 commercial POs recognize on customer approval (with installment gates)."
      />

      {poApprovals.length > 0 ? (
        <div className="mb-4">
          <Panel title="Performance obligation approvals (ASC 606)">
            <p className="mb-3 text-sm text-[var(--muted)]">
              Each approval recognizes that PO’s allocated amount. Non-final
              approvals also record an unearned installment for the next PO.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium">Event / PO</th>
                    <th className="pb-2 font-medium">Approved by</th>
                    <th className="pb-2 font-medium">Recognized</th>
                    <th className="pb-2 font-medium">Next installment</th>
                  </tr>
                </thead>
                <tbody>
                  {poApprovals.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="py-3">{formatDate(a.approved_at)}</td>
                      <td className="py-3">
                        <div>{a.event_name ?? "—"}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {a.po_title ?? a.performance_obligation_id.slice(0, 8)}
                          {a.is_final_po ? " · final" : ""}
                        </div>
                      </td>
                      <td className="py-3">{a.approved_by}</td>
                      <td className="py-3">
                        <Money amount={a.recognized_amount} />
                      </td>
                      <td className="py-3">
                        {a.installment_amount > 0 ? (
                          <Money amount={a.installment_amount} />
                        ) : (
                          <span className="text-[var(--muted)]">None (final)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="Evidence register">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Event / Invoice</th>
                  <th className="pb-2 font-medium">Ref</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">{formatDate(e.evidence_date)}</td>
                    <td className="py-3">
                      <StatusPill tone="accent">
                        {formatLabel(e.evidence_type)}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      <div>{e.event_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {e.invoice_number ?? "Contract-level"} · {e.description}
                      </div>
                    </td>
                    <td className="py-3 text-xs text-[var(--muted)]">
                      {e.supporting_ref ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Add evidence">
          <EvidenceForm
            contracts={contracts.map((c) => ({
              id: c.id,
              event_name: c.event_name,
            }))}
          />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Still deferred (awaiting recognition)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">Customer / Event</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Timing</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {deferred.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3 font-medium">{inv.invoice_number}</td>
                    <td className="py-3">
                      <div>{inv.customer_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {inv.event_name}
                      </div>
                    </td>
                    <td className="py-3">
                      <Money amount={inv.total} />
                    </td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          inv.timing_badge === "billed_before_performance"
                            ? "warn"
                            : "ok"
                        }
                      >
                        {inv.timing_badge === "billed_before_performance"
                          ? "Billed before performance"
                          : "Earned then billed"}
                      </StatusPill>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/billing/invoices/${inv.id}`}
                        className="text-sm text-[var(--accent)] hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {deferred.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-sm text-[var(--muted)]"
                    >
                      No deferred invoices.
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
