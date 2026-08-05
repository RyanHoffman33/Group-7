"use client";

import { useState } from "react";
import { formatDate } from "@/features/billing/aging";
import { Panel, StatusPill } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";
import { ModalShell } from "@/components/dashboard/customer-ui";
import type { CustomerActionItem } from "@/features/dashboard/customer-sample";

export function CustomerActionsPage() {
  const { eventActions, approveAction, requestChanges } = useCustomerPortal();
  const [active, setActive] = useState<CustomerActionItem | null>(null);
  const [changeNote, setChangeNote] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Action items"
        bodyClassName="px-3 py-1"
      >
        {eventActions.length === 0 ? (
          <p className="py-4 text-sm text-[var(--muted)]">Nothing for this event.</p>
        ) : (
          <ul>
            {eventActions.map((a) => (
              <li
                key={a.id}
                className="border-b border-[var(--line)] py-3 last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--ink)]">{a.title}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      Due {formatDate(a.dueDate)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">{a.explanation}</p>
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
          <p className="text-sm text-[var(--muted)]">{active.detail}</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            {active.options.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <label className="mt-5 block text-sm">
            <span className="mb-1.5 block font-medium">
              Request changes (optional note)
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
              onClick={() => {
                approveAction(active.id);
                setActive(null);
                setChangeNote("");
              }}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => {
                if (requestChanges(active.id, changeNote)) {
                  setActive(null);
                  setChangeNote("");
                }
              }}
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[#f7f9fb]"
            >
              Request changes
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
