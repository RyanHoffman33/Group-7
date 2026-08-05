"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  addContractDocument,
  approveChangeOrder,
  createChangeOrder,
  markPerformanceComplete,
  submitContractForApproval,
} from "@/features/contracts/actions";
import { formatDate, formatLabel } from "@/features/billing/aging";
import type {
  ContractActivityItem,
  ContractDepositSummary,
  ContractInvoiceSummary,
  ContractListRow,
  ContractPaymentSummary,
} from "@/features/contracts/queries";
import {
  STATUS_LABELS,
  depositTone,
  statusTone,
  type ContractStatus,
} from "@/features/contracts/status";
import { Money, Panel, StatusPill } from "@/components/billing/ui";

const TABS = [
  "Overview",
  "Scope and Services",
  "Financial Terms",
  "Payment Schedule",
  "Billing",
  "Event and Engagement",
  "Approvals",
  "Change Orders",
  "Documents",
  "Audit History",
] as const;

type Tab = (typeof TABS)[number];

function invoiceTone(status: string) {
  if (status === "paid") return "ok" as const;
  if (status === "void" || status === "canceled") return "neutral" as const;
  if (status === "partially_paid") return "warn" as const;
  if (status === "disputed") return "danger" as const;
  if (status === "unpaid" || status === "issued") return "accent" as const;
  return "neutral" as const;
}

function methodRateFields(contract: ContractListRow) {
  const m = contract.billing_method;
  const rows: { label: string; value: ReactNode }[] = [];
  if (m === "hourly" && Number(contract.hourly_rate) > 0) {
    rows.push({
      label: "Hourly rate",
      value: <Money amount={Number(contract.hourly_rate)} />,
    });
  }
  if (m === "cost_plus" && Number(contract.markup_percent) > 0) {
    rows.push({
      label: "Markup %",
      value: `${Number(contract.markup_percent)}%`,
    });
  }
  if (m === "retainer" && Number(contract.retainer_amount) > 0) {
    rows.push({
      label: "Retainer amount",
      value: <Money amount={Number(contract.retainer_amount)} />,
    });
  }
  if (m === "recurring" && Number(contract.recurring_amount) > 0) {
    rows.push({
      label: "Recurring amount",
      value: <Money amount={Number(contract.recurring_amount)} />,
    });
  }
  if (m === "placement_fee" && Number(contract.placement_fee_percent) > 0) {
    rows.push({
      label: "Placement fee %",
      value: `${Number(contract.placement_fee_percent)}%`,
    });
  }
  if (m === "progress" && Number(contract.progress_percent) > 0) {
    rows.push({
      label: "Progress %",
      value: `${Number(contract.progress_percent)}%`,
    });
  }
  if (m === "per_service" && Number(contract.per_service_rate) > 0) {
    rows.push({
      label: "Per-service rate",
      value: <Money amount={Number(contract.per_service_rate)} />,
    });
  }
  return rows;
}

export function ContractDetailClient({
  contract,
  lines,
  deliverables,
  milestones,
  approvals,
  documents,
  audit,
  changeOrders,
  invoices = [],
  payments = [],
  deposits = [],
}: {
  contract: ContractListRow;
  lines: Record<string, unknown>[];
  deliverables: Record<string, unknown>[];
  milestones: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  audit: ContractActivityItem[];
  changeOrders: Record<string, unknown>[];
  invoices?: ContractInvoiceSummary[];
  payments?: ContractPaymentSummary[];
  deposits?: ContractDepositSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [actor, setActor] = useState(contract.project_manager_label || "Alex Rivera");

  const [coDesc, setCoDesc] = useState("");
  const [coAmount, setCoAmount] = useState("0");
  const [coNotes, setCoNotes] = useState("");

  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docType, setDocType] = useState("other");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setError(null);
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "Action failed");
        return;
      }
      setMsg(okMsg);
      router.refresh();
    });
  }

  const field =
    "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm";
  const rateRows = methodRateFields(contract);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              {contract.contract_number}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
              {contract.event_name}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {contract.customer_name} · PM {contract.project_manager_label} ·{" "}
              {formatDate(contract.event_start)}
            </p>
            <p className="mt-1 font-mono text-xs text-[var(--muted)]">
              ID {contract.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={statusTone(contract.status)}>
              {STATUS_LABELS[contract.status as ContractStatus] ?? contract.status}
            </StatusPill>
            <StatusPill tone={depositTone(contract.deposit_status)}>
              Deposit {formatLabel(contract.deposit_status)}
            </StatusPill>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Original value</dt>
            <dd className="font-semibold">
              <Money amount={Number(contract.original_contract_value)} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Revised CV</dt>
            <dd className="font-semibold">
              <Money amount={Number(contract.contract_value)} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Change orders Σ</dt>
            <dd className="font-semibold">
              <Money amount={Number(contract.change_order_value_total)} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Next required action</dt>
            <dd className="font-semibold">
              {contract.action_hint ?? "None"}
            </dd>
          </div>
        </dl>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm border-t border-[var(--line)] pt-3">
          <div>
            <dt className="text-[var(--muted)]">Billed to date</dt>
            <dd className="font-semibold">
              <Money amount={Number(contract.billed_to_date)} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Paid to date</dt>
            <dd className="font-semibold">
              <Money amount={Number(contract.paid_to_date)} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Open A/R</dt>
            <dd className="font-semibold">
              <Money amount={Number(contract.open_ar)} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Unbilled remaining</dt>
            <dd className="font-semibold">
              <Money amount={Number(contract.unbilled_remaining)} />
            </dd>
          </div>
        </dl>
        {contract.action_hint ? (
          <p className="mt-3 text-sm text-[var(--warn)]">{contract.action_hint}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--line)] pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:bg-[#eef2f6]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-[var(--ok)]" role="status">
          {msg}
        </p>
      ) : null}

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Engagement snapshot">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2">
                <dt className="text-[var(--muted)]">Billing method</dt>
                <dd>{formatLabel(contract.billing_method)}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2">
                <dt className="text-[var(--muted)]">Currency</dt>
                <dd>{contract.currency || "USD"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2">
                <dt className="text-[var(--muted)]">Performance complete</dt>
                <dd>{contract.performance_complete ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2">
                <dt className="text-[var(--muted)]">Deposit received</dt>
                <dd>
                  <Money amount={Number(contract.deposits_received_total)} />
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2">
                <dt className="text-[var(--muted)]">Invoice collections</dt>
                <dd>
                  <Money amount={Number(contract.paid_to_date)} />
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--muted)]">Venue</dt>
                <dd>
                  {contract.venue_name ?? "—"}
                  {contract.venue_city ? `, ${contract.venue_city}` : ""}
                </dd>
              </div>
            </dl>
            {(contract.notes || contract.internal_memo) && (
              <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3 text-sm">
                {contract.notes ? (
                  <div>
                    <div className="text-[var(--muted)]">Notes / SOW</div>
                    <p className="mt-1 whitespace-pre-wrap">{contract.notes}</p>
                  </div>
                ) : null}
                {contract.internal_memo ? (
                  <div>
                    <div className="text-[var(--muted)]">Internal memo</div>
                    <p className="mt-1 whitespace-pre-wrap">
                      {contract.internal_memo}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>
          <Panel title="Quick actions">
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Actor name</span>
                <input
                  className={field}
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                />
              </label>
              {contract.status === "draft" ? (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => {
                    if (
                      !confirm(
                        "Submit this contract for project manager approval?",
                      )
                    )
                      return;
                    run(
                      () =>
                        submitContractForApproval({
                          contract_id: contract.id,
                          actor_label: actor,
                        }),
                      "Submitted for approval.",
                    );
                  }}
                >
                  Submit for approval
                </button>
              ) : null}
              {contract.status === "active" && !contract.performance_complete ? (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => {
                    if (!confirm("Mark event performance complete?")) return;
                    run(
                      () =>
                        markPerformanceComplete({
                          contract_id: contract.id,
                          actor_label: actor,
                        }),
                      "Performance marked complete.",
                    );
                  }}
                >
                  Mark performance complete
                </button>
              ) : null}
              <Link
                href="/contracts/approvals"
                className="block text-sm font-medium text-[var(--accent)]"
              >
                Open Approval Queue
              </Link>
              <Link
                href={`/billing/invoices?contract_id=${contract.id}`}
                className="block text-sm font-medium text-[var(--accent)]"
              >
                Open invoices for this contract
              </Link>
              <Link
                href="/billing/payments"
                className="block text-sm font-medium text-[var(--accent)]"
              >
                Open payments desk
              </Link>
              <Link
                href="/contracts/closeout"
                className="block text-sm font-medium text-[var(--accent)]"
              >
                Closeout desk
              </Link>
            </div>
          </Panel>
          <Panel title="Lifecycle">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Submitted</dt>
                <dd>
                  {formatDate(contract.submitted_at)}
                  {contract.submitted_by ? ` · ${contract.submitted_by}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Approved</dt>
                <dd>
                  {formatDate(contract.approved_at)}
                  {contract.approved_by ? ` · ${contract.approved_by}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Activated</dt>
                <dd>{formatDate(contract.activated_at)}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Completed</dt>
                <dd>{formatDate(contract.completed_at)}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Closed</dt>
                <dd>{formatDate(contract.closed_at)}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Version</dt>
                <dd>{contract.version ?? 1}</dd>
              </div>
              {contract.canceled_at ? (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--muted)]">Canceled</dt>
                  <dd>
                    {formatDate(contract.canceled_at)}
                    {contract.cancel_reason
                      ? ` · ${contract.cancel_reason}`
                      : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Panel>
          <Panel title="Invoices at a glance">
            {invoices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)] text-sm">
                {invoices.slice(0, 5).map((inv) => (
                  <li key={inv.id} className="flex justify-between gap-2 py-2">
                    <Link
                      href={`/billing/invoices/${inv.id}`}
                      className="font-medium text-[var(--accent)]"
                    >
                      {inv.invoice_number}
                    </Link>
                    <span>
                      <Money amount={inv.total} /> · {formatLabel(inv.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/billing/invoices?contract_id=${contract.id}`}
              className="mt-3 inline-block text-sm font-medium text-[var(--accent)]"
            >
              View all invoices →
            </Link>
          </Panel>
        </div>
      )}

      {tab === "Scope and Services" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Line items">
            {lines.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No line items.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-[var(--muted)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2">Qty</th>
                    <th className="pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={String(l.id)} className="border-b border-[var(--line)]">
                      <td className="py-2">
                        {formatLabel(String(l.line_type ?? "line"))}
                      </td>
                      <td className="py-2">
                        {String(l.description)}
                        {l.is_optional ? (
                          <span className="ml-1 text-xs text-[var(--muted)]">
                            (optional)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2">{Number(l.quantity ?? 1)}</td>
                      <td className="py-2">
                        <Money amount={Number(l.amount)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Panel title="Deliverables">
            {deliverables.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No deliverables.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)] text-sm">
                {deliverables.map((d) => (
                  <li key={String(d.id)} className="py-2">
                    <span className="font-medium">{String(d.code)}</span> —{" "}
                    {String(d.title)}
                    <div className="text-xs text-[var(--muted)]">
                      {String(d.phase)} · {String(d.status)}
                      {d.commercial_amount != null
                        ? ` · $${Number(d.commercial_amount).toLocaleString()}`
                        : ""}
                      {d.is_performance_obligation ? " · PO" : ""}
                    </div>
                    {d.description ? (
                      <p className="mt-1 text-[var(--muted)]">
                        {String(d.description)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === "Financial Terms" && (
        <Panel title="Commercial terms">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Original contract value</dt>
              <dd className="font-semibold">
                <Money amount={Number(contract.original_contract_value)} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Current revised value</dt>
              <dd className="font-semibold">
                <Money amount={Number(contract.contract_value)} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Billed / Paid / Open A/R</dt>
              <dd className="font-semibold">
                <Money amount={Number(contract.billed_to_date)} /> /{" "}
                <Money amount={Number(contract.paid_to_date)} /> /{" "}
                <Money amount={Number(contract.open_ar)} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Unbilled remaining</dt>
              <dd className="font-semibold">
                <Money amount={Number(contract.unbilled_remaining)} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Deposit required</dt>
              <dd>
                {contract.deposit_required
                  ? `${contract.deposit_percent}% of original`
                  : "No"}
                {contract.minimum_deposit_amount
                  ? ` (min $${Number(contract.minimum_deposit_amount).toLocaleString()})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Deposit received</dt>
              <dd>
                <Money amount={Number(contract.deposits_received_total)} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Discount</dt>
              <dd>
                <Money amount={Number(contract.discount_amount ?? 0)} /> /{" "}
                {Number(contract.discount_percent ?? 0)}%
                {contract.discount_requires_approval
                  ? contract.discount_approved
                    ? " · approved"
                    : " · needs approval"
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Requires deposit before work</dt>
              <dd>{contract.requires_deposit_before_work ? "Yes" : "No"}</dd>
            </div>
            {rateRows.map((r) => (
              <div key={r.label}>
                <dt className="text-[var(--muted)]">{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-[var(--muted)]">Cancellation policy</dt>
              <dd className="mt-1">{contract.cancellation_policy_text ?? "—"}</dd>
            </div>
          </dl>
        </Panel>
      )}

      {tab === "Payment Schedule" && (
        <Panel title="Milestones">
          {milestones.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No milestones.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2">Label</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Due</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">% CV</th>
                  <th className="pb-2">Billed</th>
                  <th className="pb-2">Done</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={String(m.id)} className="border-b border-[var(--line)]">
                    <td className="py-2">{String(m.label)}</td>
                    <td className="py-2">{formatLabel(String(m.milestone_type ?? ""))}</td>
                    <td className="py-2">{formatDate(m.due_date as string)}</td>
                    <td className="py-2">
                      <Money amount={Number(m.amount)} />
                    </td>
                    <td className="py-2">
                      {m.percent_of_contract != null
                        ? `${Number(m.percent_of_contract)}%`
                        : "—"}
                    </td>
                    <td className="py-2">
                      {m.billed_invoice_id ? (
                        <Link
                          href={`/billing/invoices/${String(m.billed_invoice_id)}`}
                          className="text-[var(--accent)]"
                        >
                          Yes
                        </Link>
                      ) : (
                        "No"
                      )}
                    </td>
                    <td className="py-2">{m.completed ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === "Billing" && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <Panel title="Billed">
              <p className="text-lg font-semibold">
                <Money amount={Number(contract.billed_to_date)} />
              </p>
            </Panel>
            <Panel title="Paid">
              <p className="text-lg font-semibold">
                <Money amount={Number(contract.paid_to_date)} />
              </p>
            </Panel>
            <Panel title="Open A/R">
              <p className="text-lg font-semibold">
                <Money amount={Number(contract.open_ar)} />
              </p>
            </Panel>
            <Panel title="Unbilled">
              <p className="text-lg font-semibold">
                <Money amount={Number(contract.unbilled_remaining)} />
              </p>
            </Panel>
          </div>
          <Panel
            title="Invoices"
            action={
              <Link
                href={`/billing/invoices?contract_id=${contract.id}`}
                className="text-sm font-medium text-[var(--accent)]"
              >
                Open filtered list
              </Link>
            }
          >
            {invoices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No invoices.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-[var(--muted)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="pb-2">Invoice</th>
                    <th className="pb-2">Issued</th>
                    <th className="pb-2">Due</th>
                    <th className="pb-2">Total</th>
                    <th className="pb-2">Paid</th>
                    <th className="pb-2">Outstanding</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-[var(--line)]">
                      <td className="py-2">
                        <Link
                          href={`/billing/invoices/${inv.id}`}
                          className="font-medium text-[var(--accent)]"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="py-2">{formatDate(inv.issue_date)}</td>
                      <td className="py-2">{formatDate(inv.due_date)}</td>
                      <td className="py-2">
                        <Money amount={inv.total} />
                      </td>
                      <td className="py-2">
                        <Money amount={inv.paid} />
                      </td>
                      <td className="py-2">
                        <Money amount={inv.outstanding} />
                      </td>
                      <td className="py-2">
                        <StatusPill tone={invoiceTone(inv.status)}>
                          {formatLabel(inv.status)}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Payments applied">
              {payments.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No payments applied.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)] text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="py-2">
                      <div className="flex justify-between gap-2">
                        <Link
                          href={`/billing/invoices/${p.invoice_id}`}
                          className="font-medium text-[var(--accent)]"
                        >
                          {p.invoice_number}
                        </Link>
                        <Money amount={p.amount} />
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatDate(p.paid_at)}
                        {p.method ? ` · ${formatLabel(p.method)}` : ""}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Deposits">
              {deposits.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No deposits.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)] text-sm">
                  {deposits.map((d) => (
                    <li
                      key={d.id}
                      className="flex justify-between gap-2 py-2"
                    >
                      <span>
                        {formatDate(d.received_at)} · {formatLabel(d.status)}
                      </span>
                      <Money amount={d.amount} />
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/billing/deposits"
                className="mt-3 inline-block text-sm font-medium text-[var(--accent)]"
              >
                Deposits desk →
              </Link>
            </Panel>
          </div>
        </div>
      )}

      {tab === "Event and Engagement" && (
        <Panel title="Event">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Type</dt>
              <dd>{formatLabel(contract.event_type)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Guests</dt>
              <dd>{contract.guest_count ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Start</dt>
              <dd>{formatDate(contract.event_start)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">End</dt>
              <dd>{formatDate(contract.event_end)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Venue</dt>
              <dd>
                {contract.venue_name ?? "—"}
                {contract.venue_city ? `, ${contract.venue_city}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Project manager</dt>
              <dd>{contract.project_manager_label}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Customer</dt>
              <dd>{contract.customer_name}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Billing method</dt>
              <dd>{formatLabel(contract.billing_method)}</dd>
            </div>
          </dl>
        </Panel>
      )}

      {tab === "Approvals" && (
        <Panel title="Approval history">
          {approvals.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No approval actions yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)] text-sm">
              {approvals.map((a) => (
                <li key={String(a.id)} className="py-3">
                  <div className="font-medium">
                    {formatLabel(String(a.action))} by {String(a.actor_label)}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {formatDate(String(a.acted_at))} · {String(a.from_status)} →{" "}
                    {String(a.to_status)}
                  </div>
                  {a.comments ? (
                    <p className="mt-1 text-[var(--muted)]">{String(a.comments)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "Change Orders" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Change orders">
            {changeOrders.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No change orders.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)] text-sm">
                {changeOrders.map((m) => (
                  <li key={String(m.id)} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{String(m.mod_number)}</span>
                      <StatusPill
                        tone={
                          m.status === "applied"
                            ? "ok"
                            : m.status === "approved"
                              ? "accent"
                              : "warn"
                        }
                      >
                        {String(m.status)}
                      </StatusPill>
                    </div>
                    <p className="mt-1">{String(m.description)}</p>
                    <p className="text-xs text-[var(--muted)]">
                      Δ <Money amount={Number(m.price_change)} /> ·{" "}
                      {formatLabel(String(m.accounting_treatment))}
                      {m.requested_by
                        ? ` · requested by ${String(m.requested_by)}`
                        : ""}
                    </p>
                    {(m.prior_contract_value != null ||
                      m.new_contract_value != null) && (
                      <p className="text-xs text-[var(--muted)]">
                        CV{" "}
                        <Money amount={Number(m.prior_contract_value ?? 0)} /> →{" "}
                        <Money amount={Number(m.new_contract_value ?? 0)} />
                      </p>
                    )}
                    {m.scope_change_notes ? (
                      <p className="mt-1 text-[var(--muted)]">
                        {String(m.scope_change_notes)}
                      </p>
                    ) : null}
                    {m.status === "draft" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="mt-2 text-sm font-medium text-[var(--accent)]"
                        onClick={() => {
                          if (!confirm(`Commercially approve ${m.mod_number}?`))
                            return;
                          run(
                            () =>
                              approveChangeOrder({
                                modification_id: String(m.id),
                                actor_label: actor,
                              }),
                            "Change order approved (accounting apply remains in Compliance).",
                          );
                        }}
                      >
                        Approve commercially
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Request change order">
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Description</span>
                <textarea
                  className={field}
                  rows={3}
                  value={coDesc}
                  onChange={(e) => setCoDesc(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">
                  Price change (+/−)
                </span>
                <input
                  type="number"
                  className={field}
                  value={coAmount}
                  onChange={(e) => setCoAmount(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Scope notes</span>
                <textarea
                  className={field}
                  rows={2}
                  value={coNotes}
                  onChange={(e) => setCoNotes(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => {
                  if (!coDesc.trim()) {
                    setError("Description required");
                    return;
                  }
                  if (!confirm("Create draft change order?")) return;
                  run(
                    () =>
                      createChangeOrder({
                        contract_id: contract.id,
                        description: coDesc,
                        price_change: Number(coAmount) || 0,
                        scope_change_notes: coNotes,
                        requested_by: actor,
                        line_items: [
                          {
                            action: "change",
                            description: coDesc,
                            amount_change: Number(coAmount) || 0,
                          },
                        ],
                      }),
                    "Change order created as draft.",
                  );
                  setCoDesc("");
                  setCoAmount("0");
                  setCoNotes("");
                }}
              >
                Create draft CO
              </button>
            </div>
          </Panel>
        </div>
      )}

      {tab === "Documents" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Documents">
            {documents.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No documents.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)] text-sm">
                {documents.map((d) => (
                  <li key={String(d.id)} className="py-2">
                    <div className="font-medium">{String(d.title)}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatLabel(String(d.doc_type))} · {String(d.uploaded_by)}
                    </div>
                    {d.external_url ? (
                      <a
                        href={String(d.external_url)}
                        className="text-[var(--accent)]"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open link
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Add document metadata">
            <div className="space-y-3">
              <input
                className={field}
                placeholder="Title"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
              />
              <select
                className={field}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {[
                  "proposal",
                  "contract",
                  "change_order",
                  "cancellation",
                  "approval",
                  "other",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                className={field}
                placeholder="URL (optional)"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
              />
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  if (!docTitle.trim()) {
                    setError("Title required");
                    return;
                  }
                  run(
                    () =>
                      addContractDocument({
                        contract_id: contract.id,
                        title: docTitle,
                        doc_type: docType,
                        external_url: docUrl || undefined,
                        uploaded_by: actor,
                      }),
                    "Document added.",
                  );
                  setDocTitle("");
                  setDocUrl("");
                }}
              >
                Add document
              </button>
            </div>
          </Panel>
        </div>
      )}

      {tab === "Audit History" && (
        <Panel title="Activity trail">
          {audit.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)] text-sm">
              {audit.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="font-medium">
                    {e.href ? (
                      <Link href={e.href} className="text-[var(--accent)]">
                        {e.summary}
                      </Link>
                    ) : (
                      e.summary
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {formatLabel(e.event_type)} · {e.actor_label} ·{" "}
                    {formatDate(e.created_at)}
                    {e.from_status || e.to_status
                      ? ` · ${e.from_status ?? "—"} → ${e.to_status ?? "—"}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
