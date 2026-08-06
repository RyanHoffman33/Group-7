"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { customerRespondToQuoteAction } from "@/features/requests/actions";
import type { EventRequest } from "@/features/requests/types";
import { Panel, StatusPill } from "@/components/billing/ui";

export function CustomerQuotesPanel({ quotes }: { quotes: EventRequest[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!quotes.length) {
    return (
      <Panel title="Package quotes">
        <p className="py-3 text-sm text-[var(--muted)]">
          No package quotes yet. Submit an inquiry under{" "}
          <span className="font-medium text-[var(--ink)]">Your inquiry</span>,
          then estimates appear here after MainEvent reviews your request.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Package quotes">
      <ul className="divide-y divide-[var(--line)]">
        {quotes.map((q) => (
          <li key={q.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--ink)]">{q.eventName}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {q.quote?.packageLabel} · $
                  {q.quote?.amount.toLocaleString() ?? "—"}
                </p>
                {q.quote?.notes ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {q.quote.notes}
                  </p>
                ) : null}
              </div>
              <StatusPill
                compact
                tone={
                  q.status === "accepted"
                    ? "ok"
                    : q.status === "changes_requested"
                      ? "warn"
                      : "accent"
                }
              >
                {q.status === "quoted"
                  ? "Quote ready"
                  : q.status === "accepted"
                    ? "Accepted"
                    : q.status === "changes_requested"
                      ? "Changes requested"
                      : q.status.replace(/_/g, " ")}
              </StatusPill>
            </div>
            {q.status === "quoted" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("requestId", q.id);
                    fd.set("decision", "accept");
                    start(async () => {
                      await customerRespondToQuoteAction(fd);
                      router.refresh();
                    });
                  }}
                >
                  Accept & sign
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-xs font-medium disabled:opacity-60"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("requestId", q.id);
                    fd.set("decision", "changes");
                    start(async () => {
                      await customerRespondToQuoteAction(fd);
                      router.refresh();
                    });
                  }}
                >
                  Request changes
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
