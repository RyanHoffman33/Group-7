"use client";

import { useState, useTransition } from "react";
import { AlertCard } from "@/components/dashboard";
import { StatusPill } from "@/components/billing/ui";
import { decideApprovalAction } from "@/features/access/actions";
import type { ApprovalItem } from "@/features/access/types";

export function ApprovalsClient({
  items,
  actorUserId,
  actorRole,
}: {
  items: ApprovalItem[];
  actorUserId: string;
  actorRole: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {message ? <AlertCard tone="ok" title="Updated" body={message} /> : null}
      {error ? <AlertCard tone="danger" title="Denied" body={error} /> : null}
      {items.map((item) => {
        const isSelf = item.submittedByUserId === actorUserId;
        return (
          <div
            key={item.id}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {item.kind.replace("_", " ")} · ${item.amount.toLocaleString()}
                  {item.percent != null ? ` · ${item.percent}%` : ""} · submitted by{" "}
                  {item.submittedByName}
                </p>
              </div>
              <StatusPill
                tone={
                  item.status === "approved"
                    ? "ok"
                    : item.status === "rejected"
                      ? "danger"
                      : "warn"
                }
              >
                {item.status.replace("_", " ")}
              </StatusPill>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Required approver: {item.approverRoleRequired.replace(/_/g, " ")} ·
              Your role: {actorRole.replace(/_/g, " ")}
            </p>
            {isSelf ? (
              <p className="mt-2 text-sm text-[var(--danger)]">
                You cannot approve this item because you submitted it.
              </p>
            ) : null}
            {item.approvedByName ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Decided by {item.approvedByName} at {item.decidedAt}
                {item.comment ? ` — ${item.comment}` : ""}
              </p>
            ) : null}
            {item.status === "submitted" && !item.locked ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || isSelf}
                  title={
                    isSelf
                      ? "You cannot approve this expense because you submitted it."
                      : undefined
                  }
                  className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  onClick={() =>
                    start(async () => {
                      if (!confirm(`Approve “${item.title}”?`)) return;
                      setError(null);
                      setMessage(null);
                      const res = await decideApprovalAction({
                        approvalId: item.id,
                        decision: "approved",
                      });
                      if (res.ok) setMessage(res.message);
                      else setError(res.error);
                    })
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pending || isSelf}
                  className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  onClick={() =>
                    start(async () => {
                      if (!confirm(`Reject “${item.title}”?`)) return;
                      const comment = window.prompt(
                        "Rejection reason (required):",
                      );
                      if (comment == null) return;
                      if (!comment.trim()) {
                        setError("A rejection reason is required.");
                        return;
                      }
                      setError(null);
                      setMessage(null);
                      const res = await decideApprovalAction({
                        approvalId: item.id,
                        decision: "rejected",
                        comment: comment.trim(),
                      });
                      if (res.ok) setMessage(res.message);
                      else setError(res.error);
                    })
                  }
                >
                  Reject
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
