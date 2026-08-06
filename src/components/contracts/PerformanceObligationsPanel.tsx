"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Money, Panel, StatusPill } from "@/components/billing/ui";
import {
  markPoReadyForApproval,
  recordPoInstallment,
  saveContractPerformanceObligations,
} from "@/features/performance-obligations/actions";
import {
  PO_STATUS_LABELS,
  allocationReconciles,
  statusTone,
  type ContractPerformanceObligation,
  type ContractPoSummary,
  type PoApproval,
  type PoDraftInput,
} from "@/features/performance-obligations";
import { formatDate } from "@/features/billing/aging";

type DraftRow = PoDraftInput & { key: string };

function emptyRow(): DraftRow {
  return {
    key: Math.random().toString(36).slice(2),
    title: "",
    description: "",
    completion_definition: "",
    amount: 0,
  };
}

export function PerformanceObligationsPanel({
  contractId,
  contractValue,
  contractStatus,
  obligations,
  summary,
  approvals,
  actorLabel,
}: {
  contractId: string;
  contractValue: number;
  contractStatus: string;
  obligations: ContractPerformanceObligation[];
  summary: ContractPoSummary | null;
  approvals: PoApproval[];
  actorLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(obligations.length === 0);
  const [rows, setRows] = useState<DraftRow[]>(() =>
    obligations.length
      ? obligations.map((o) => ({
          key: o.id,
          title: o.title,
          description: o.description ?? "",
          completion_definition: o.completion_definition,
          amount: o.amount,
        }))
      : [emptyRow(), emptyRow(), emptyRow()],
  );

  const allocated = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );
  const variance = allocated - contractValue;
  const reconciled = allocationReconciles(allocated, contractValue);
  const canRewrite =
    obligations.length === 0 ||
    obligations.every((o) => o.status === "draft" || o.status === "active");
  const negotiation =
    contractStatus === "draft" ||
    contractStatus === "pending_approval" ||
    contractStatus === "deposit_pending" ||
    contractStatus === "approved" ||
    contractStatus === "active";

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setMsg(res.message ?? "Saved.");
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Panel
        title="ASC 606 performance obligations"
        action={
          canRewrite && negotiation ? (
            <button
              type="button"
              className="text-sm font-semibold text-[var(--accent)]"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Cancel edit" : "Define / edit POs"}
            </button>
          ) : null
        }
      >
        <p className="mb-3 text-sm text-[var(--muted)]">
          Identify distinct promises to the customer during negotiation. Allocated
          amounts must equal contract value. Revenue is recognized only when the
          customer approves completion — and approving a non-final PO requires
          paying the installment for the <em>next</em> PO.
        </p>

        {summary ? (
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-[var(--line)] px-3 py-2">
              <p className="text-[11px] text-[var(--muted)]">Contract value</p>
              <Money amount={summary.contract_value} />
            </div>
            <div className="rounded-md border border-[var(--line)] px-3 py-2">
              <p className="text-[11px] text-[var(--muted)]">PO allocated</p>
              <Money amount={summary.po_allocated_total} />
            </div>
            <div className="rounded-md border border-[var(--line)] px-3 py-2">
              <p className="text-[11px] text-[var(--muted)]">Recognized</p>
              <Money amount={summary.recognized_from_pos} />
            </div>
            <div className="rounded-md border border-[var(--line)] px-3 py-2">
              <p className="text-[11px] text-[var(--muted)]">Allocation variance</p>
              <span
                className={
                  Math.abs(summary.allocation_variance) <= 0.01
                    ? "text-[#1b6b3a]"
                    : "text-[var(--danger)]"
                }
              >
                <Money amount={summary.allocation_variance} />
              </span>
            </div>
          </div>
        ) : null}

        {editing ? (
          <div className="flex flex-col gap-3">
            {rows.map((row, idx) => (
              <div
                key={row.key}
                className="rounded-md border border-[var(--line)] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    PO {idx + 1}
                  </span>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-[var(--danger)]"
                      onClick={() =>
                        setRows((prev) => prev.filter((r) => r.key !== row.key))
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium">Title</span>
                    <input
                      className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                      value={row.title}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key
                              ? { ...r, title: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium">
                      Completion criteria
                    </span>
                    <textarea
                      rows={2}
                      className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                      value={row.completion_definition}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key
                              ? {
                                  ...r,
                                  completion_definition: e.target.value,
                                }
                              : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium">
                      Description (optional)
                    </span>
                    <input
                      className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                      value={row.description}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key
                              ? { ...r, description: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">
                      Allocated amount
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                      value={row.amount || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key
                              ? {
                                  ...r,
                                  amount: Number(e.target.value) || 0,
                                }
                              : r,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold"
                onClick={() => setRows((prev) => [...prev, emptyRow()])}
              >
                Add PO
              </button>
              <span
                className={`text-sm ${
                  reconciled ? "text-[#1b6b3a]" : "text-[var(--danger)]"
                }`}
              >
                Sum <Money amount={allocated} /> vs contract{" "}
                <Money amount={contractValue} />
                {!reconciled
                  ? ` (variance $${variance.toFixed(2)} — must reconcile)`
                  : " ✓"}
              </span>
            </div>
            <button
              type="button"
              disabled={pending || !reconciled}
              className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() =>
                run(() =>
                  saveContractPerformanceObligations({
                    contractId,
                    obligations: rows.map(
                      ({ title, description, completion_definition, amount }) => ({
                        title,
                        description,
                        completion_definition,
                        amount,
                      }),
                    ),
                    lockActive: true,
                  }),
                )
              }
            >
              {pending ? "Saving…" : "Save performance obligations"}
            </button>
          </div>
        ) : obligations.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No performance obligations defined yet. Define them while negotiating
            so installment gates and recognition are clear.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {obligations.map((po, i) => {
              const isLast = i === obligations.length - 1;
              const next = obligations[i + 1];
              return (
                <li key={po.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--ink)]">
                        PO {po.seq}: {po.title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {po.completion_definition}
                      </p>
                      {po.description ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {po.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {po.installment_deposit_id
                          ? "Installment on file (unearned until this PO completes)."
                          : po.seq === 1
                            ? "Needs initial installment before approval."
                            : "Installment arrives when prior PO is approved."}
                        {!isLast && next
                          ? ` Approving this PO requires paying PO ${next.seq} ($${next.amount.toLocaleString()}).`
                          : " Final PO — no new payment on approval."}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Money amount={po.amount} />
                      <StatusPill compact tone={statusTone(po.status)}>
                        {PO_STATUS_LABELS[po.status]}
                      </StatusPill>
                      {po.recognized_amount != null ? (
                        <span className="text-xs text-[#1b6b3a]">
                          Recognized <Money amount={po.recognized_amount} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {po.seq === 1 &&
                    !po.installment_deposit_id &&
                    po.status !== "completed" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
                        onClick={() =>
                          run(() =>
                            recordPoInstallment({
                              performanceObligationId: po.id,
                            }),
                          )
                        }
                      >
                        Record PO1 installment
                      </button>
                    ) : null}
                    {(po.status === "active" || po.status === "draft") &&
                    po.installment_deposit_id ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                        onClick={() =>
                          run(() =>
                            markPoReadyForApproval({
                              performanceObligationId: po.id,
                              actor: actorLabel,
                            }),
                          )
                        }
                      >
                        Release for customer approval
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        {msg ? (
          <p className="mt-3 text-sm text-[#1b6b3a]" role="status">
            {msg}
          </p>
        ) : null}
      </Panel>

      {approvals.length > 0 ? (
        <Panel title="PO approval audit trail">
          <ul className="divide-y divide-[var(--line)] text-sm">
            {approvals.map((a) => (
              <li key={a.id} className="py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    {a.approved_by} · {formatDate(a.approved_at)}
                    {a.is_final_po ? " · final PO" : ""}
                  </span>
                  <span>
                    Recognized <Money amount={a.recognized_amount} />
                    {a.installment_amount > 0
                      ? ` · next installment $${a.installment_amount.toLocaleString()}`
                      : ""}
                  </span>
                </div>
                {a.notes ? (
                  <p className="text-xs text-[var(--muted)]">{a.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
