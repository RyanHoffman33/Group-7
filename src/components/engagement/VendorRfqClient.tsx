"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/features/billing/aging";
import { StatusPill } from "@/components/billing/ui";
import { submitVendorQuoteAction } from "@/features/engagement/actions";
import type { VendorQuote, VendorRfq } from "@/features/engagement/types";

export function VendorRfqQuoteForm({ rfq }: { rfq: VendorRfq }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(rfq.status === "quoted");

  if (done) {
    return (
      <p className="text-sm text-[var(--ok)]">
        Quote submitted for this RFQ.
      </p>
    );
  }

  return (
    <form
      className="mt-3 space-y-2 border-t border-[var(--line)] pt-3"
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await submitVendorQuoteAction(fd);
          if (!res.ok) setError(res.error ?? "Submit failed.");
          else setDone(true);
        });
      }}
    >
      <input type="hidden" name="rfqId" value={rfq.id} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Quote amount</span>
        <input
          name="amount"
          type="number"
          min={1}
          step="0.01"
          required
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Notes</span>
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit quote"}
      </button>
    </form>
  );
}

export function VendorRfqList({
  rfqs,
  myQuotes,
}: {
  rfqs: VendorRfq[];
  myQuotes: VendorQuote[];
}) {
  const quotedRfqIds = new Set(myQuotes.map((q) => q.rfq_id));

  return (
    <div className="space-y-3">
      {rfqs.map((rfq) => (
        <div
          key={rfq.id}
          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-medium">{rfq.title}</h3>
              <p className="text-sm text-[var(--muted)]">
                {rfq.inquiry_event_name ?? "Engagement"} · sent{" "}
                {new Date(rfq.sent_at).toLocaleDateString()}
              </p>
            </div>
            <StatusPill tone={rfq.status === "sent" ? "warn" : "ok"}>
              {rfq.status}
            </StatusPill>
          </div>
          {rfq.message ? (
            <p className="mt-2 text-sm text-[var(--muted)]">{rfq.message}</p>
          ) : null}
          {quotedRfqIds.has(rfq.id) ? (
            <p className="mt-3 text-sm text-[var(--ok)]">
              You already quoted{" "}
              {formatCurrency(
                myQuotes.find((q) => q.rfq_id === rfq.id)?.amount ?? 0,
              )}
              .
            </p>
          ) : (
            <VendorRfqQuoteForm rfq={rfq} />
          )}
        </div>
      ))}
    </div>
  );
}
