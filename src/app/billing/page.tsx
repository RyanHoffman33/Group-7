import Link from "next/link";
import { AGING_BUCKETS, formatCurrency, formatPercent } from "@/features/billing/aging";
import { getDashboardMetrics, listAlerts } from "@/features/billing/queries";
import { Money, PageHeader, Panel, StatCard, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function BillingDashboardPage() {
  const [metrics, alerts] = await Promise.all([
    getDashboardMetrics(),
    listAlerts(false),
  ]);

  return (
    <div>
      <PageHeader
        title="A/R Dashboard"
        description="Outstanding receivables, unearned deposits (liabilities), and collection-weighted expectations."
        actions={
          <Link
            href="/billing/invoices"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            New invoice
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total outstanding A/R"
          value={formatCurrency(metrics.totalOutstanding)}
          hint="Open unpaid / disputed invoices net of applications"
        />
        <StatCard
          label="Expected collections"
          value={formatCurrency(metrics.expectedCollections)}
          hint="Outstanding × P(collect) by customer history"
          tone="accent"
        />
        <StatCard
          label="Unearned deposits"
          value={formatCurrency(metrics.unearnedDeposits)}
          hint="Customer deposits held as liabilities"
          tone="warn"
        />
        <StatCard
          label="Open billing alerts"
          value={String(metrics.openAlertCount)}
          hint="Aging bucket transitions awaiting ack"
          tone={metrics.openAlertCount > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Aging mix">
          <div className="space-y-3">
            {AGING_BUCKETS.map((b) => {
              const amt = metrics.byBucket[b];
              const pct =
                metrics.totalOutstanding > 0
                  ? amt / metrics.totalOutstanding
                  : 0;
              return (
                <div key={b}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{b}</span>
                    <span className="text-[var(--muted)]">
                      <Money amount={amt} /> · {formatPercent(pct)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e8eef3]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                      style={{
                        width: `${metrics.totalOutstanding > 0 ? pct * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="GAAP posture">
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
              <dt className="text-[var(--muted)]">
                Deferred (performance not complete)
              </dt>
              <dd className="font-semibold">
                <Money amount={metrics.deferredRevenue} />
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
              <dt className="text-[var(--muted)]">
                Recognized open A/R
              </dt>
              <dd className="font-semibold">
                <Money amount={metrics.recognizedOpenAr} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Unearned deposit liability</dt>
              <dd className="font-semibold">
                <Money amount={metrics.unearnedDeposits} />
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Revenue is recognized only when contractual performance obligations
            are satisfied. Deposits remain liabilities until applied/earned.
          </p>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Recent unacknowledged alerts"
          action={
            <Link
              href="/billing/alerts"
              className="text-sm font-medium text-[var(--accent)]"
            >
              View all
            </Link>
          }
        >
          {alerts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No open alerts. Run an aging check from the Alerts page after
              balances age into new buckets.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {alerts.slice(0, 5).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {a.invoice_number} · {a.customer_name}
                    </p>
                    <p className="text-[var(--muted)]">
                      Moved {a.from_bucket} → {a.to_bucket}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone="danger">
                      <Money amount={a.outstanding_amount} /> outstanding
                    </StatusPill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
