import Link from "next/link";
import { formatCurrency } from "@/features/billing/aging";
import {
  getPositionTotals,
  listContractPositions,
} from "@/features/gaap/queries";
import { Money, PageHeader, Panel, StatCard, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function ComplianceDashboardPage() {
  const positions = await listContractPositions();
  const totals = await getPositionTotals(positions);

  return (
    <div>
      <PageHeader
        title="Contract position"
        description="ASC 606 contract assets (earned not billed), contract liabilities (unearned deposits + deferred billed), and open A/R — read from Billing without rewriting invoices."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Contract assets"
          value={formatCurrency(totals.contractAsset)}
          hint="Earned not billed"
          tone="accent"
        />
        <StatCard
          label="Contract liabilities"
          value={formatCurrency(totals.contractLiability)}
          hint="Unearned deposits + deferred billed"
          tone="warn"
        />
        <StatCard
          label="Open A/R"
          value={formatCurrency(totals.openAr)}
          hint="Unpaid / disputed outstanding"
        />
        <StatCard
          label="Recognized (billed)"
          value={formatCurrency(totals.recognizedBilled)}
          hint="Invoices with recognition_status = recognized"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Liability split">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
              <dt className="text-[var(--muted)]">Unearned deposits</dt>
              <dd className="font-semibold">
                <Money amount={totals.unearnedDeposits} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">
                Deferred billed outstanding
              </dt>
              <dd className="font-semibold">
                <Money amount={totals.deferredBilled} />
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Source views:{" "}
            <code className="text-[11px]">v_gaap_contract_position</code>,{" "}
            <code className="text-[11px]">v_contract_asset</code>,{" "}
            <code className="text-[11px]">v_contract_liability</code>.
          </p>
        </Panel>
        <Panel title="Quick links">
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/compliance/recognition">
                Recognition evidence & deferred invoices
              </Link>
            </li>
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/compliance/deposits-retainers">
                Deposits & retainers as liabilities
              </Link>
            </li>
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/compliance/audit">
                Audit pack export
              </Link>
            </li>
            <li>
              <Link className="text-[var(--accent)] hover:underline" href="/compliance/policies">
                Policy register
              </Link>
            </li>
          </ul>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Per-contract position">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Earned</th>
                  <th className="pb-2 font-medium">Billed</th>
                  <th className="pb-2 font-medium">Asset</th>
                  <th className="pb-2 font-medium">Liability</th>
                  <th className="pb-2 font-medium">Open A/R</th>
                  <th className="pb-2 font-medium">Perf.</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr
                    key={p.contract_id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-3">
                      <div className="font-medium">{p.event_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {p.customer_name}
                      </div>
                    </td>
                    <td className="py-3">
                      <Money amount={p.earned_to_date} />
                    </td>
                    <td className="py-3">
                      <Money amount={p.billed_to_date} />
                    </td>
                    <td className="py-3">
                      <Money amount={p.contract_asset} />
                    </td>
                    <td className="py-3">
                      <Money amount={p.total_contract_liability} />
                    </td>
                    <td className="py-3">
                      <Money amount={p.open_ar} />
                    </td>
                    <td className="py-3">
                      <StatusPill tone={p.performance_complete ? "ok" : "warn"}>
                        {p.performance_complete ? "Complete" : "In progress"}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
