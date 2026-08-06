import Link from "next/link";
import { formatDate } from "@/features/billing/aging";
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

function shortContractRef(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-4)}`;
}

export default async function ContractsDashboardPage() {
  const m = await getDashboardMetrics();

  return (
    <div>
      <PageHeader
        title="Contracts Dashboard"
        description="What needs attention next — approvals, deposits, and closeout — without treating status changes as revenue."
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
          hint="Waiting on review"
          tone={m.pendingApprovalCount > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Awaiting deposit"
          value={String(m.depositPendingCount)}
          hint="Open engagements only"
          tone={m.depositPendingCount > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Items needing action"
          value={String(m.requiringAction.length)}
          tone={m.requiringAction.length ? "danger" : "default"}
        />
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        Portfolio value, approved change-order totals, and closeout counts live on{" "}
        <Link href="/contracts/list" className="text-[var(--accent)] hover:underline">
          All Contracts
        </Link>
        ,{" "}
        <Link href="/contracts/changes" className="text-[var(--accent)] hover:underline">
          Contract Changes
        </Link>
        , and{" "}
        <Link href="/contracts/closeout" className="text-[var(--accent)] hover:underline">
          Closeout
        </Link>
        .
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Needs action now"
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
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-semibold text-[var(--accent)]"
                      title={c.contract_number ?? c.id}
                    >
                      {shortContractRef(c.contract_number ?? c.id)}
                    </Link>
                    <p className="text-sm text-[var(--ink)]">{c.event_name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.customer_name}
                    </p>
                    {c.action_hint ? (
                      <p className="mt-1 text-sm text-[var(--warn)]">
                        {c.action_hint}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill
                    tone={
                      c.status === "pending_approval" ||
                      c.status === "deposit_pending"
                        ? "warn"
                        : "accent"
                    }
                  >
                    {STATUS_LABELS[c.status as ContractStatus] ?? c.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Deposit & approval risks">
          {m.atRisk.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No deposit or approval risks flagged.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {m.atRisk.slice(0, 8).map((c) => (
                <li key={c.id} className="py-3">
                  <Link
                    href={`/contracts/${c.id}`}
                    className="font-semibold text-[var(--accent)]"
                    title={c.contract_number ?? undefined}
                  >
                    {shortContractRef(c.contract_number ?? c.id)} · {c.event_name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {c.action_hint ??
                      STATUS_LABELS[c.status as ContractStatus] ??
                      c.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Upcoming events"
          action={
            <Link
              href="/contracts/list"
              className="text-sm font-medium text-[var(--accent)]"
            >
              Pipeline
            </Link>
          }
        >
          {m.upcomingEvents.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No events in the next 45 days.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {m.upcomingEvents.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-medium text-[var(--accent)]"
                    >
                      {c.event_name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">
                      {c.customer_name}
                    </p>
                  </div>
                  <span className="text-[var(--muted)]">
                    {c.event_start ? formatDate(c.event_start) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Closeout candidates"
          action={
            <Link
              href="/contracts/closeout"
              className="text-sm font-medium text-[var(--accent)]"
            >
              Open closeout
            </Link>
          }
        >
          {m.readyForCloseout.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Nothing ready for closeout review.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {m.readyForCloseout.slice(0, 6).map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <Link
                    href={`/contracts/closeout?contract=${c.id}`}
                    className="font-medium text-[var(--accent)]"
                  >
                    {c.event_name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {shortContractRef(c.contract_number ?? c.id)} ·{" "}
                    <Money amount={Number(c.contract_value)} />
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
