"use client";

import { useState } from "react";
import { formatDate } from "@/features/billing/aging";
import { Panel, StatusPill } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";
import { ModalShell } from "@/components/dashboard/customer-ui";
import { checkpointLabel } from "@/features/involvement/checkpoints";
import type { ApprovalItemWithMeta } from "@/features/involvement/types";

export function CustomerActionsPage() {
  const { eventApprovals, approveAction, requestChanges, deciding } =
    useCustomerPortal();
  const [active, setActive] = useState<ApprovalItemWithMeta | null>(null);
  const [changeNote, setChangeNote] = useState("");

  const visible = eventApprovals.filter((a) => a.status !== "superseded");

  return (
    <div className="flex flex-col gap-3">
      <Panel title="Action items" bodyClassName="px-3 py-1">
        {visible.length === 0 ? (
          <p className="py-4 text-sm text-[var(--muted)]">
            Nothing awaiting your review for this event.
          </p>
        ) : (
          <ul>
            {visible.map((a) => (
              <li
                key={a.id}
                className="border-b border-[var(--line)] py-3 last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--ink)]">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      {checkpointLabel(a.checkpoint_type)}
                      {a.due_date ? ` · Due ${formatDate(a.due_date)}` : ""}
                      {` · v${a.version}`}
                    </p>
                    {a.supporting_info ? (
                      <p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">
                        {a.supporting_info}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill
                    compact
                    tone={
                      a.status === "approved"
                        ? "ok"
                        : a.status === "changes_requested"
                          ? "warn"
                          : "danger"
                    }
                  >
                    {a.status === "approved"
                      ? "Approved"
                      : a.status === "changes_requested"
                        ? "Changes requested"
                        : "Needs you"}
                  </StatusPill>
                </div>
                {a.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setChangeNote("");
                      setActive(a);
                    }}
                    className="mt-3 inline-flex rounded-md bg-[var(--ink)] px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90"
                  >
                    Review & decide
                  </button>
                ) : a.decisions[0] ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {a.decisions[0].decision.replace(/_/g, " ")} by{" "}
                    {a.decisions[0].customer_contact} on{" "}
                    {formatDate(a.decisions[0].decided_at)}
                    {a.decisions[0].comments
                      ? ` — ${a.decisions[0].comments}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {active ? (
        <ModalShell
          title={active.title}
          wide
          onClose={() => {
            setActive(null);
            setChangeNote("");
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            {checkpointLabel(active.checkpoint_type)}
            {active.due_date ? ` · Due ${formatDate(active.due_date)}` : ""}
            {` · Version ${active.version}`}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">
            {active.supporting_info || "No additional details provided."}
          </p>
          <label className="mt-5 block text-sm">
            <span className="mb-1.5 block font-medium">
              Request changes (required when requesting changes)
            </span>
            <textarea
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              rows={3}
              placeholder="Example: Prefer buffet over plated lunch."
              className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={deciding}
              onClick={() => {
                approveAction(active.id);
                setActive(null);
                setChangeNote("");
              }}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={deciding}
              onClick={() => {
                requestChanges(active.id, changeNote);
                if (changeNote.trim()) {
                  setActive(null);
                  setChangeNote("");
                }
              }}
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[#f7f9fb] disabled:opacity-50"
            >
              Request changes
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
