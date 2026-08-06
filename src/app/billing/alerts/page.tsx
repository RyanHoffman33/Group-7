import {
  AcknowledgeButton,
  RunAgingCheckButton,
} from "@/components/billing/Actions";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { formatDate } from "@/features/billing/aging";
import { listAlerts } from "@/features/billing/queries";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const [open, all] = await Promise.all([
    listAlerts(false),
    listAlerts(true),
  ]);
  const acked = all.filter((a) => a.acknowledged_at);

  return (
    <div>
      <PageHeader
        title="Billing alerts"
        description="Automated reminders when an A/R balance moves into a new aging bucket — amount outstanding included for the billing team."
        actions={<RunAgingCheckButton />}
      />

      <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
        Aging alerts update when receivables move into a new past-due range.
        Use <strong className="font-medium text-[var(--ink)]">Run aging check</strong>{" "}
        above to refresh open alerts for the billing team.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Open alerts (${open.length})`}>
          {open.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No unacknowledged alerts.
            </p>
          ) : (
            <ul className="space-y-3">
              {open.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-[var(--danger)]/20 bg-[#fdf6f6] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--ink)]">
                        {a.invoice_number} · {a.customer_name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Aging moved{" "}
                        <StatusPill tone="neutral">{a.from_bucket}</StatusPill>{" "}
                        →{" "}
                        <StatusPill tone="danger">{a.to_bucket}</StatusPill>
                      </p>
                      <p className="mt-2 text-sm">
                        Outstanding:{" "}
                        <strong>
                          <Money amount={a.outstanding_amount} />
                        </strong>
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDate(a.created_at)} · {a.channel}
                      </p>
                    </div>
                    <AcknowledgeButton alertId={a.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Acknowledged">
          {acked.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">None yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {acked.slice(0, 20).map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between gap-3 border-b border-[var(--line)] py-2"
                >
                  <span>
                    {a.invoice_number} · {a.from_bucket} → {a.to_bucket}
                  </span>
                  <Money amount={a.outstanding_amount} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
