"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/features/billing/aging";
import {
  approveInquiryWithQuoteAction,
  terminateInquiryAction,
} from "@/features/engagement/actions";
import type { EngagementInquiry } from "@/features/engagement/types";
import { ENGAGEMENT_STATUS_LABELS } from "@/features/engagement/status";
import { StatusPill } from "@/components/billing/ui";

export function InquiryApprovalCard({ inquiry }: { inquiry: EngagementInquiry }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState([
    { description: "Event production package", amount: "" },
  ]);

  function onApprove(formData: FormData) {
    setError(null);
    formData.set(
      "lineItemsJson",
      JSON.stringify(
        lines
          .filter((l) => l.description.trim() && Number(l.amount) > 0)
          .map((l) => ({
            description: l.description.trim(),
            amount: Number(l.amount),
          })),
      ),
    );
    startTransition(async () => {
      const res = await approveInquiryWithQuoteAction(formData);
      if (!res.ok) setError(res.error ?? "Approval failed.");
    });
  }

  function onTerminate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await terminateInquiryAction(formData);
      if (!res.ok) setError(res.error ?? "Terminate failed.");
    });
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{inquiry.event_name}</h3>
          <p className="text-sm text-[var(--muted)]">
            {inquiry.organization} · {inquiry.contact_name} ·{" "}
            {inquiry.preferred_start}
          </p>
        </div>
        <StatusPill
          tone={inquiry.status === "quote_denied" ? "warn" : "accent"}
        >
          {ENGAGEMENT_STATUS_LABELS[inquiry.status]}
        </StatusPill>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--muted)]">Type / guests</dt>
          <dd>
            {inquiry.event_type}
            {inquiry.guest_count != null ? ` · ${inquiry.guest_count}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Budget</dt>
          <dd>{inquiry.budget_range}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--muted)]">Location</dt>
          <dd>{inquiry.location}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--muted)]">Description</dt>
          <dd>{inquiry.description}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
        <p className="text-sm font-medium text-[var(--ink)]">
          Approval requires a submitted company quote
        </p>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <form action={onApprove} className="space-y-3">
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Lump sum (used if no line amounts)
            </span>
            <input
              name="amount"
              type="number"
              min={1}
              step="0.01"
              placeholder="e.g. 75000"
              className="w-full rounded-md border border-[var(--line)] px-3 py-2"
            />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">Line items (optional)</p>
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                <input
                  value={line.description}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], description: e.target.value };
                    setLines(next);
                  }}
                  placeholder="Description"
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                />
                <input
                  value={line.amount}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], amount: e.target.value };
                    setLines(next);
                  }}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount"
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-[var(--accent)] underline"
              onClick={() =>
                setLines([...lines, { description: "", amount: "" }])
              }
            >
              Add line
            </button>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Notes</span>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-md border border-[var(--line)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Valid until</span>
            <input
              type="date"
              name="validUntil"
              className="rounded-md border border-[var(--line)] px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Approve inquiry & send quote"}
          </button>
        </form>

        {inquiry.status === "quote_denied" ? (
          <form action={onTerminate} className="flex flex-wrap gap-2">
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <input
              name="reason"
              placeholder="Terminate reason"
              className="min-w-[12rem] flex-1 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-[var(--danger)] px-4 py-2 text-sm text-[var(--danger)] disabled:opacity-60"
            >
              Terminate engagement
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function SourcingRfqForm({
  inquiryId,
  vendors,
  onSend,
}: {
  inquiryId: string;
  vendors: { id: string; name: string }[];
  onSend: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-2 rounded-md border border-[var(--line)] p-3"
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await onSend(fd);
          if (!res.ok) setError(res.error ?? "Failed to send RFQ.");
        });
      }}
    >
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <p className="text-sm font-medium">Send vendor inquiry</p>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <select
        name="vendorId"
        required
        className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        defaultValue=""
      >
        <option value="" disabled>
          Select vendor…
        </option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <input
        name="title"
        required
        placeholder="RFQ title"
        className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
      />
      <textarea
        name="message"
        rows={2}
        placeholder="Scope / requirements"
        className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send RFQ"}
      </button>
    </form>
  );
}

export function MarkupOfferForm({
  inquiryId,
  vendorQuoteId,
  vendorAmount,
  vendorName,
  onSend,
}: {
  inquiryId: string;
  vendorQuoteId: string;
  vendorAmount: number;
  vendorName?: string;
  onSend: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState("20");
  const markup = Math.round(vendorAmount * (Number(pct) / 100) * 100) / 100;
  const customer = Math.round((vendorAmount + markup) * 100) / 100;

  return (
    <form
      className="space-y-2 rounded-md bg-[var(--bg)] p-3 text-sm"
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await onSend(fd);
          if (!res.ok) setError(res.error ?? "Failed to send offer.");
        });
      }}
    >
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="vendorQuoteId" value={vendorQuoteId} />
      <p className="font-medium">
        {vendorName ?? "Vendor"} quote {formatCurrency(vendorAmount)}
      </p>
      <label className="block">
        Markup %
        <input
          name="markupPercent"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          type="number"
          min={0}
          step="0.1"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
      </label>
      <p className="text-[var(--muted)]">
        Markup {formatCurrency(markup)} → customer price{" "}
        <strong className="text-[var(--ink)]">{formatCurrency(customer)}</strong>
      </p>
      <textarea
        name="notes"
        rows={2}
        placeholder="Customer-facing notes"
        className="w-full rounded-md border border-[var(--line)] px-3 py-2"
      />
      {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Pass marked-up quote to customer"}
      </button>
    </form>
  );
}
