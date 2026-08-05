import Link from "next/link";
import { formatDate, formatLabel } from "@/features/billing/aging";
import { listContractsForGaap } from "@/features/gaap/adapters/contracts";
import {
  listDeferredInvoices,
  listRecognitionEvidence,
} from "@/features/gaap/queries";
import { EvidenceForm } from "@/components/gaap/Actions";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function RecognitionPage() {
  const [evidence, deferred, contracts] = await Promise.all([
    listRecognitionEvidence(),
    listDeferredInvoices(),
    listContractsForGaap(),
  ]);

  return (
    <div>
      <PageHeader
        title="Revenue recognition"
        description="Revenue posts only when performance is satisfied and recognition evidence is on file. Cash alone is not earning."
      />

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
