import { formatDate, formatLabel } from "@/features/billing/aging";
import {
  buildAuditPack,
  listAuditLedger,
  listRecognitionEvidence,
} from "@/features/gaap/queries";
import { AuditExportButton } from "@/components/gaap/Actions";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string; asOf?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const entryType = sp.type || undefined;
  const asOf = sp.asOf || undefined;

  const [ledger, evidence, pack] = await Promise.all([
    listAuditLedger({ entryType, asOf }),
    listRecognitionEvidence(),
    buildAuditPack(),
  ]);

  const entryTypes = [
    ...new Set(ledger.map((l) => l.entry_type).concat(["revenue_recognize", "contract_modification"])),
  ].sort();

  return (
    <div>
      <PageHeader
        title="Audit pack"
        description="Append-only ledger browser plus recognition evidence. Export JSON/CSV for demo walkthroughs. Carson can gate recognition / mod apply once Controls + roles exist."
        actions={<AuditExportButton packJson={JSON.stringify(pack)} />}
      />

      <Panel title="Filters">
        <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
          <label className="text-xs font-medium text-[var(--muted)]">
            Entry type
            <select
              name="type"
              defaultValue={entryType ?? ""}
              className="mt-1 block rounded-md border border-[var(--line)] px-3 py-2"
            >
              <option value="">All</option>
              {entryTypes.map((t) => (
                <option key={t} value={t}>
                  {formatLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            As of date
            <input
              type="date"
              name="asOf"
              defaultValue={asOf ?? ""}
              className="mt-1 block rounded-md border border-[var(--line)] px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </form>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <Panel title="Ledger entries">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">Debit</th>
                  <th className="pb-2 font-medium">Credit</th>
                  <th className="pb-2 font-medium">Memo</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3 text-xs">
                      {formatDate(l.created_at.slice(0, 10))}
                    </td>
                    <td className="py-3">
                      <StatusPill tone="neutral">
                        {formatLabel(l.entry_type)}
                      </StatusPill>
                    </td>
                    <td className="py-3">{l.invoice_number ?? "—"}</td>
                    <td className="py-3">
                      <Money amount={l.debit} />
                    </td>
                    <td className="py-3">
                      <Money amount={l.credit} />
                    </td>
                    <td className="py-3 text-xs text-[var(--muted)]">
                      {l.memo ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Evidence attached to recognition">
          <ul className="space-y-3 text-sm">
            {evidence.map((e) => (
              <li
                key={e.id}
                className="border-b border-[var(--line)] pb-3 last:border-0"
              >
                <div className="font-medium">{formatLabel(e.evidence_type)}</div>
                <div className="text-xs text-[var(--muted)]">
                  {e.event_name} · {e.invoice_number ?? "contract"} ·{" "}
                  {formatDate(e.evidence_date)}
                </div>
                <div className="mt-1 text-xs">{e.description}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
