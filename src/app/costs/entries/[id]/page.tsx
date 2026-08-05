import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatLabel } from "@/features/billing/aging";
import { categoryLabel } from "@/features/costs/config";
import { getCostEntry, listCostHistory } from "@/features/costs/queries";
import { activeFlags, flagReasons } from "@/features/costs/flags";
import {
  ActualizeCostButton,
  CostEditForm,
} from "@/components/costs/Actions";
import {
  CostFlagPills,
  CostFlagsBanner,
} from "@/components/costs/CostFlagsBanner";
import {
  Money,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function CostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await getCostEntry(id);
  if (!entry) notFound();

  const flags = activeFlags(entry);
  const reasons = flagReasons(entry);
  const history = await listCostHistory(id);

  return (
    <div>
      <PageHeader
        title="Cost detail"
        description={`${categoryLabel(entry.category)} · ${entry.event_name} · ${entry.customer_name}`}
        actions={
          <Link
            href={`/costs/events/${entry.contract_id}`}
            className="text-sm font-semibold text-[var(--accent)]"
          >
            ← Event costs
          </Link>
        }
      />

      <CostFlagsBanner flags={flags} reasons={reasons} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Entry">
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Amount
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                <Money amount={entry.amount} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Category
              </dt>
              <dd className="mt-1">
                <StatusPill>{categoryLabel(entry.category)}</StatusPill>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Contract / event
              </dt>
              <dd className="mt-1">{entry.event_name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Customer
              </dt>
              <dd className="mt-1">{entry.customer_name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Commitment
              </dt>
              <dd className="mt-1">{formatLabel(entry.commitment_status)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Approval
              </dt>
              <dd className="mt-1">
                <StatusPill
                  tone={
                    entry.approval_status === "pending_approval"
                      ? "warn"
                      : entry.approval_status === "rejected"
                        ? "danger"
                        : entry.approval_status === "approved"
                          ? "ok"
                          : "neutral"
                  }
                >
                  {formatLabel(entry.approval_status)}
                </StatusPill>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Incurred
              </dt>
              <dd className="mt-1">{formatDate(entry.incurred_date)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Entered by
              </dt>
              <dd className="mt-1">
                {entry.entered_by} · {formatDate(entry.entered_at.slice(0, 10))}
              </dd>
            </div>
            {entry.prior_committed_amount != null ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  Prior committed $
                </dt>
                <dd className="mt-1">
                  <Money amount={entry.prior_committed_amount} />
                </dd>
              </div>
            ) : null}
            {entry.worker_label ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  Worker
                </dt>
                <dd className="mt-1">
                  {entry.worker_label} ({entry.hours}h × ${entry.rate})
                </dd>
              </div>
            ) : null}
            {entry.vendor_name ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  Vendor / payee
                </dt>
                <dd className="mt-1">
                  {entry.vendor_name}
                  {entry.invoice_ref ? ` · ${entry.invoice_ref}` : ""}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Reimbursable
              </dt>
              <dd className="mt-1">
                {entry.is_reimbursable ? "Yes (passthrough)" : "No"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Notes
              </dt>
              <dd className="mt-1 text-[var(--muted)]">
                {entry.notes ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Flags
              </dt>
              <dd className="mt-1">
                {flags.length ? (
                  <CostFlagPills entry={entry} />
                ) : (
                  <span className="text-[var(--muted)]">None</span>
                )}
              </dd>
            </div>
          </dl>
        </Panel>

        <div className="space-y-4">
          {entry.commitment_status === "committed" ? (
            <Panel title="Actualize commitment">
              <ActualizeCostButton
                entryId={entry.id}
                committedAmount={entry.amount}
              />
            </Panel>
          ) : null}
          <Panel title="Edit">
            <CostEditForm entry={entry} />
          </Panel>
        </div>
      </div>

      <div className="mt-4">
        <Panel title="History / audit log">
          {history.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No history yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {history.map((h) => (
                <li key={h.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[var(--ink)]">
                      {formatLabel(h.action)}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-[var(--muted)]">
                    by {h.actor}
                    {h.detail ? ` — ${h.detail}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
