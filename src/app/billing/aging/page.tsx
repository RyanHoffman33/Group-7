import Link from "next/link";
import { AGING_BUCKETS, formatLabel, formatPercent } from "@/features/billing/aging";
import { buildAgingReport } from "@/features/billing/queries";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function AgingPage() {
  const rows = await buildAgingReport();
  const byBucket = AGING_BUCKETS.map((b) => ({
    bucket: b,
    amount: rows
      .filter((r) => r.bucket === b)
      .reduce((s, r) => s + r.outstanding, 0),
    expected: rows
      .filter((r) => r.bucket === b)
      .reduce((s, r) => s + r.expected_collection, 0),
  }));

  const totalExpected = rows.reduce((s, r) => s + r.expected_collection, 0);
  const totalOut = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div>
      <PageHeader
        title="Aging & collections"
        description="Classic A/R aging with collection probabilities from each customer’s payment history (portfolio priors when history is thin)."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {byBucket.map((b) => (
          <div
            key={b.bucket}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
          >
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              {b.bucket}
            </p>
            <p className="mt-1 text-lg font-semibold">
              <Money amount={b.amount} />
            </p>
            <p className="text-xs text-[var(--muted)]">
              E[collect] <Money amount={b.expected} />
            </p>
          </div>
        ))}
      </div>

      <Panel
        title="Open receivables"
        action={
          <span className="text-sm text-[var(--muted)]">
            Portfolio expected: <Money amount={totalExpected} /> of{" "}
            <Money amount={totalOut} />
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="pb-2 font-medium">Invoice</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Bucket</th>
                <th className="pb-2 font-medium">DPD</th>
                <th className="pb-2 font-medium">Outstanding</th>
                <th className="pb-2 font-medium">P(collect)</th>
                <th className="pb-2 font-medium">Expected $</th>
                <th className="pb-2 font-medium">Recognition</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => b.days_past_due - a.days_past_due)
                .map((r) => (
                  <tr
                    key={r.invoice_id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">
                      <Link
                        href={`/billing/invoices/${r.invoice_id}`}
                        className="font-semibold text-[var(--accent)]"
                      >
                        {r.invoice_number}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">
                        {r.event_name}
                      </div>
                    </td>
                    <td className="py-3">{r.customer_name}</td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          r.bucket === "current"
                            ? "ok"
                            : r.bucket === "90+"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {r.bucket}
                      </StatusPill>
                    </td>
                    <td className="py-3 tabular-nums">{r.days_past_due}</td>
                    <td className="py-3">
                      <Money amount={r.outstanding} />
                    </td>
                    <td className="py-3">{formatPercent(r.p_collect)}</td>
                    <td className="py-3">
                      <Money amount={r.expected_collection} />
                    </td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          r.recognition_status === "recognized" ? "ok" : "warn"
                        }
                      >
                        {formatLabel(r.recognition_status)}
                      </StatusPill>
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
