"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveContract,
  rejectContract,
  returnContractToDraft,
} from "@/features/contracts/actions";
import { formatDate } from "@/features/billing/aging";
import type { ContractListRow } from "@/features/contracts/queries";
import { Money, StatusPill } from "@/components/billing/ui";

export function ApprovalQueueClient({ rows }: { rows: ContractListRow[] }) {
  const router = useRouter();
  const [actor, setActor] = useState("Alex Rivera");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  function missingInfo(c: ContractListRow): string[] {
    const m: string[] = [];
    if (!c.event_start) m.push("Event date");
    if (!c.project_manager_label) m.push("Project manager");
    if (!c.cancellation_policy_text) m.push("Cancellation terms");
    if (Number(c.contract_value) <= 0) m.push("Contract value");
    return m;
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-sm text-sm">
        <span className="mb-1 block text-[var(--muted)]">
          Acting project manager
        </span>
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        />
      </label>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--line)] p-10 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl">
            Approval Queue is empty
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            No contracts are pending project manager approval.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="pb-2 font-medium">Contract</th>
                <th className="pb-2 font-medium">Value / Deposit</th>
                <th className="pb-2 font-medium">Submitted</th>
                <th className="pb-2 font-medium">Missing</th>
                <th className="pb-2 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const missing = missingInfo(c);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--line)] align-top"
                  >
                    <td className="py-3">
                      <Link
                        href={`/contracts/${c.id}`}
                        className="font-semibold text-[var(--accent)]"
                      >
                        {c.contract_number}
                      </Link>
                      <div>{c.event_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {c.customer_name}
                      </div>
                    </td>
                    <td className="py-3">
                      <div>
                        <Money amount={Number(c.contract_value)} />
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Discount{" "}
                        <Money amount={Number(c.discount_amount ?? 0)} />
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Deposit{" "}
                        {c.deposit_required
                          ? `${c.deposit_percent}% original`
                          : "none"}
                      </div>
                    </td>
                    <td className="py-3">
                      <div>{c.submitted_by ?? "—"}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatDate(c.submitted_at)}
                      </div>
                    </td>
                    <td className="py-3">
                      {missing.length === 0 ? (
                        <StatusPill tone="ok">Complete</StatusPill>
                      ) : (
                        <span className="text-xs text-[var(--warn)]">
                          {missing.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <textarea
                        className="mb-2 w-full rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                        placeholder="Reject / return reason"
                        rows={2}
                        value={reasonById[c.id] ?? ""}
                        onChange={(e) =>
                          setReasonById((s) => ({
                            ...s,
                            [c.id]: e.target.value,
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={() => {
                            if (!confirm(`Approve ${c.contract_number}?`)) return;
                            setError(null);
                            start(async () => {
                              const r = await approveContract({
                                contract_id: c.id,
                                actor_label: actor,
                                actor_role: "project_manager",
                              });
                              if (!r.ok) setError(r.error);
                              else router.refresh();
                            });
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded-md border border-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)]"
                          onClick={() => {
                            const reason = reasonById[c.id]?.trim();
                            if (!reason) {
                              setError("Rejection reason required.");
                              return;
                            }
                            if (!confirm(`Reject ${c.contract_number}?`)) return;
                            setError(null);
                            start(async () => {
                              const r = await rejectContract({
                                contract_id: c.id,
                                actor_label: actor,
                                reason,
                              });
                              if (!r.ok) setError(r.error);
                              else router.refresh();
                            });
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
                          onClick={() => {
                            const comments = reasonById[c.id]?.trim();
                            if (!comments) {
                              setError("Comments required to return to draft.");
                              return;
                            }
                            if (!confirm(`Return ${c.contract_number} to draft?`))
                              return;
                            setError(null);
                            start(async () => {
                              const r = await returnContractToDraft({
                                contract_id: c.id,
                                actor_label: actor,
                                comments,
                              });
                              if (!r.ok) setError(r.error);
                              else router.refresh();
                            });
                          }}
                        >
                          Return to draft
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
