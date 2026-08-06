"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Money, Panel, StatusPill } from "@/components/billing/ui";
import { ModalShell } from "@/components/dashboard/customer-ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";
import { approvePerformanceObligation } from "@/features/performance-obligations/actions";
import {
  PO_STATUS_LABELS,
  statusTone,
  type CustomerPoView,
} from "@/features/performance-obligations";
import { formatDate } from "@/features/billing/aging";

export function CustomerObligationsClient({
  obligations,
}: {
  obligations: CustomerPoView[];
}) {
  const router = useRouter();
  const { selectedId, showFlash } = useCustomerPortal();
  const [pending, start] = useTransition();
  const [active, setActive] = useState<CustomerPoView | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      obligations.filter(
        (o) => !selectedId || o.contract_id === selectedId,
      ),
    [obligations, selectedId],
  );

  const awaiting = visible.filter((o) => o.status === "awaiting_approval");

  return (
    <div className="flex flex-col gap-3">
      <Panel title="Performance obligations (ASC 606)" bodyClassName="px-3 py-3">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Each obligation is a distinct promise in your contract. When work on a
          PO is complete, you approve it here.{" "}
          <strong className="font-semibold text-[var(--ink)]">
            Approving a non-final PO requires paying the installment for the next
            PO
          </strong>{" "}
          (held as unearned revenue until that next PO is completed). The final
          PO needs no additional payment — prior installments already cover the
          contract.
        </p>

        {visible.length === 0 ? (
          <p className="py-4 text-sm text-[var(--muted)]">
            No performance obligations are linked to this event yet.
          </p>
        ) : (
          <ul>
            {visible.map((po) => (
              <li
                key={po.id}
                className="border-b border-[var(--line)] py-3 last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--ink)]">
                      PO {po.seq}: {po.title}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      {po.event_name} · Allocated{" "}
                      <Money amount={po.amount} />
                      {po.ready_for_approval_at
                        ? ` · Ready ${formatDate(po.ready_for_approval_at)}`
                        : ""}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      <span className="font-medium text-[var(--ink)]">
                        Completion criteria:{" "}
                      </span>
                      {po.completion_definition}
                    </p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {po.gate_message}
                    </p>
                  </div>
                  <StatusPill compact tone={statusTone(po.status)}>
                    {PO_STATUS_LABELS[po.status]}
                  </StatusPill>
                </div>
                {po.status === "awaiting_approval" && po.can_approve ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setConfirmText("");
                      setActive(po);
                    }}
                    className="mt-3 inline-flex rounded-md bg-[var(--ink)] px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90"
                  >
                    {po.is_last
                      ? "Approve final PO (no payment)"
                      : `Approve & pay next installment`}
                  </button>
                ) : null}
                {po.status === "completed" && po.approved_at ? (
                  <p className="mt-2 text-xs text-[#1b6b3a]">
                    Approved by {po.approved_by} on {formatDate(po.approved_at)}
                    {" — "}
                    <Money amount={po.recognized_amount ?? po.amount} />{" "}
                    recognized
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {awaiting.length === 0 && visible.length > 0 ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Nothing currently awaiting your approval. Your project manager will
            release the next PO when work is complete.
          </p>
        ) : null}
      </Panel>

      {active ? (
        <ModalShell
          title={`Approve PO ${active.seq}: ${active.title}`}
          wide
          onClose={() => {
            setActive(null);
            setConfirmText("");
            setError(null);
          }}
        >
          <p className="text-sm text-[var(--muted)]">
            {active.completion_definition}
          </p>

          <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm">
            {active.is_last ? (
              <>
                <p className="font-semibold text-[var(--ink)]">
                  Final performance obligation
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  No additional installment is required. Prior installments
                  already cover the full contract value (
                  <Money amount={active.contract_value} />
                  ). Approving confirms completion and recognizes{" "}
                  <Money amount={active.amount} /> as revenue.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-[var(--ink)]">
                  Installment gate (next PO)
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  To approve this PO, you must pay the installment for{" "}
                  <strong>
                    PO {active.next_po?.seq}: {active.next_po?.title}
                  </strong>{" "}
                  of <Money amount={active.installment_required} />. That cash is
                  recorded as an <em>unearned</em> deposit until that next PO is
                  completed. Approving this PO also recognizes{" "}
                  <Money amount={active.amount} /> of revenue for work already
                  delivered.
                </p>
              </>
            )}
          </div>

          <label className="mt-5 block text-sm">
            <span className="mb-1.5 block font-medium">
              Type APPROVE to confirm
            </span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="APPROVE"
              className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </label>

          {error ? (
            <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || confirmText.trim().toUpperCase() !== "APPROVE"}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => {
                setError(null);
                start(async () => {
                  const res = await approvePerformanceObligation({
                    performanceObligationId: active.id,
                    confirmationText: confirmText,
                  });
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  showFlash(res.message ?? "Performance obligation approved.");
                  setActive(null);
                  setConfirmText("");
                  router.refresh();
                });
              }}
            >
              {pending
                ? "Processing…"
                : active.is_last
                  ? "Confirm final approval"
                  : "Pay installment & approve"}
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setActive(null);
                setConfirmText("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
