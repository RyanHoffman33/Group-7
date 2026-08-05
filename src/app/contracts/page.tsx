import Link from "next/link";
import { formatCurrency, formatDate } from "@/features/billing/aging";
import { getDashboardMetrics } from "@/features/contracts/queries";
import { STATUS_LABELS, type ContractStatus } from "@/features/contracts/status";
import {
  Money,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function ContractsDashboardPage() {
  const m = await getDashboardMetrics();

  return (
    <div>
      <PageHeader
        title="Contracts Dashboard"
        description="Engagement pipeline for MainEvent: approvals, deposits, event readiness, and closeout — without treating status changes as revenue."
        actions={
          <Link
            href="/contracts/new"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Create contract
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active contracts"
          value={String(m.activeCount)}
          hint="Work authorized"
          tone="accent"
        />
        <StatCard
          label="Pending approval"
          value={String(m.pendingApprovalCount)}
          hint="PM queue"
          tone={m.pendingApprovalCount > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Awaiting deposit"
          value={String(m.depositPendingCount)}
          hint="% of original value"
          tone={m.depositPendingCount > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Current contract value"
          value={formatCurrency(m.totalCurrentValue)}
          hint="Excludes canceled/closed"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Approved change-order value (Σ)"
          value={formatCurrency(m.totalChangeOrderValue)}
          hint="change_order_value_total across contracts"
        />
        <StatCard
          label="Requiring action"
          value={String(m.requiringAction.length)}
          tone={m.requiringAction.length ? "danger" : "default"}
        />
        <StatCard
          label="Ready for closeout review"
          value={String(m.readyForCloseout.length)}
          hint="Completed or performance complete"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Contracts requiring action"
          action={
            <Link
              href="/contracts/list"
              className="text-sm font-medium text-[var(--accent)]"
            >
              View all
            </Link>
          }
        >
          {m.requiringAction.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No open action items right now.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {m.requiringAction.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-semibold text-[var(--accent)]"
                    >
                      {c.contract_number}
                    </Link>
                    <p className="text-sm text-[var(--ink)]">{c.event_name}</p>
                    <p className="text-xs text-[var(--muted)]">{c.action_hint}</p>
                  </div>
                  <StatusPill tone="warn">
                    {STATUS_LABELS[c.status as ContractStatus] ?? c.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="At risk / deposit & approval">
          {m.atRisk.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No deposit or approval risk flags.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {m.atRisk.slice(0, 10).map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <Link
                    href={`/contracts/${c.id}`}
                    className="font-semibold text-[var(--accent)]"
                  >
                    {c.contract_number}
                  </Link>
                  <span className="text-[var(--muted)]"> · {c.customer_name}</span>
                  <div className="text-xs text-[var(--muted)]">
                    Deposit {c.deposit_status} · {c.action_hint}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming events (45 days)">
          {m.upcomingEvents.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No events in the next 45 days.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {m.upcomingEvents.map((c) => (
                <li key={c.id} className="flex justify-between gap-2 py-3 text-sm">
                  <div>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-semibold text-[var(--accent)]"
                    >
                      {c.event_name}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">
                      {c.venue_city ?? "—"} · {c.project_manager_label}
                    </div>
                  </div>
                  <span className="tabular-nums text-[var(--muted)]">
                    {formatDate(c.event_start)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Upcoming payment milestones"
          action={
            <Link
              href="/billing/determine"
              className="text-sm font-medium text-[var(--accent)]"
            >
              Billing
            </Link>
          }
        >
          {m.upcomingMilestones.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No open milestones with due dates.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="pb-2 font-medium">Contract</th>
                    <th className="pb-2 font-medium">Milestone</th>
                    <th className="pb-2 font-medium">Due</th>
                    <th className="pb-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {m.upcomingMilestones.map((row, i) => (
                    <tr
                      key={`${row.contract_id}-${i}`}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="py-2">
                        <Link
                          href={`/contracts/${row.contract_id}`}
                          className="font-medium text-[var(--accent)]"
                        >
                          {row.contract_number}
                        </Link>
                        <div className="text-xs text-[var(--muted)]">
                          {row.event_name}
                        </div>
                      </td>
                      <td className="py-2">{row.label}</td>
                      <td className="py-2">{formatDate(row.due_date)}</td>
                      <td className="py-2">
                        <Money amount={row.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Closeout candidates"
          action={
            <Link
              href="/contracts/closeout"
              className="text-sm font-medium text-[var(--accent)]"
            >
              Closeout desk
            </Link>
          }
        >
          {m.readyForCloseout.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No completed engagements to review.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {m.readyForCloseout.map((c) => (
                <li key={c.id} className="flex justify-between py-3 text-sm">
                  <Link
                    href={`/contracts/${c.id}`}
                    className="font-semibold text-[var(--accent)]"
                  >
                    {c.contract_number}
                  </Link>
                  <Money amount={Number(c.contract_value)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Canceled (policy / forfeit review)">
          {m.canceledRecent.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No canceled contracts.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {m.canceledRecent.map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <Link
                    href={`/contracts/${c.id}`}
                    className="font-semibold text-[var(--accent)]"
                  >
                    {c.contract_number}
                  </Link>
                  <div className="text-xs text-[var(--muted)]">
                    {c.cancel_reason ?? "No reason on file"}
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
