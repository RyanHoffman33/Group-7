"use client";

import { useActionState, useState, useTransition } from "react";
import { StatusPill } from "@/components/billing/ui";
import { formatCurrency } from "@/features/billing/aging";
import {
  acceptCompanyQuoteAction,
  decideVendorOfferAction,
  denyCompanyQuoteAction,
  submitEngagementInquiryAction,
} from "@/features/engagement/actions";
import {
  BUDGET_RANGE_OPTIONS,
  EVENT_TYPE_OPTIONS,
  type CompanyQuote,
  type CustomerFacingVendorOffer,
  type EngagementInquiry,
} from "@/features/engagement/types";
import {
  DEFAULT_DEPOSIT_PERCENT,
  ENGAGEMENT_STATUS_LABELS,
} from "@/features/engagement/status";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--danger)]">{message}</p>;
}

export function CustomerInquiryForm({
  organization,
  phone,
}: {
  organization: string;
  phone: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitEngagementInquiryAction,
    null,
  );

  if (state?.id) {
    return (
      <div className="rounded-md border border-[#b7e4c7] bg-[#e6f6ec] px-4 py-3 text-sm text-[#1b6b3a]">
        Inquiry submitted. Our executives and project managers will review it
        and send a company quote.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state?.error ? (
        <p className="text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Organization</span>
        <input
          name="organization"
          defaultValue={organization}
          required
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
        <FieldError message={state?.fieldErrors?.organization} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Event name</span>
        <input
          name="eventName"
          required
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
        <FieldError message={state?.fieldErrors?.eventName} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Event type</span>
          <select
            name="eventType"
            required
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {EVENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={state?.fieldErrors?.eventType} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Budget range</span>
          <select
            name="budgetRange"
            required
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {BUDGET_RANGE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <FieldError message={state?.fieldErrors?.budgetRange} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Preferred start</span>
          <input
            type="date"
            name="preferredStart"
            required
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
          <FieldError message={state?.fieldErrors?.preferredStart} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Preferred end</span>
          <input
            type="date"
            name="preferredEnd"
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Location</span>
        <input
          name="location"
          required
          placeholder="City, venue preference"
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
        <FieldError message={state?.fieldErrors?.location} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Guest count (approx.)</span>
          <input
            name="guestCount"
            type="number"
            min={1}
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
          <FieldError message={state?.fieldErrors?.guestCount} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Phone</span>
          <input
            name="contactPhone"
            defaultValue={phone}
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea
          name="description"
          required
          rows={4}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
        />
        <FieldError message={state?.fieldErrors?.description} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit inquiry"}
      </button>
    </form>
  );
}

export function CustomerQuoteCard({
  inquiry,
  quote,
}: {
  inquiry: EngagementInquiry;
  quote: CompanyQuote;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const deposit =
    Math.round(quote.amount * (DEFAULT_DEPOSIT_PERCENT / 100) * 100) / 100;

  function onAccept(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await acceptCompanyQuoteAction(formData);
      if (!res.ok) setError(res.error ?? "Could not accept.");
    });
  }

  function onDeny(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await denyCompanyQuoteAction(formData);
      if (!res.ok) setError(res.error ?? "Could not deny.");
    });
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-[var(--ink)]">{inquiry.event_name}</h3>
          <p className="text-sm text-[var(--muted)]">
            Company quote v{quote.version}
          </p>
        </div>
        <StatusPill tone="accent">
          {ENGAGEMENT_STATUS_LABELS[inquiry.status]}
        </StatusPill>
      </div>
      <p className="mt-3 font-[family-name:var(--font-display)] text-2xl">
        {formatCurrency(quote.amount)}
      </p>
      {quote.line_items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
          {quote.line_items.map((li) => (
            <li key={li.description} className="flex justify-between gap-4">
              <span>{li.description}</span>
              <span>{formatCurrency(li.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {quote.notes ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{quote.notes}</p>
      ) : null}

      {inquiry.status === "quote_sent" ? (
        <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <form action={onAccept} className="space-y-3">
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <input type="hidden" name="payDeposit" value="true" />
            <p className="text-sm text-[var(--ink)]">
              Accept requires a digital signature and a{" "}
              <strong>{DEFAULT_DEPOSIT_PERCENT}%</strong> down payment (
              {formatCurrency(deposit)}).
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Type your full legal name (e-sign)
              </span>
              <input
                name="signerName"
                required
                className="w-full rounded-md border border-[var(--line)] px-3 py-2"
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirmDeposit" required className="mt-1" />
              <span>
                I authorize the {formatCurrency(deposit)} deposit and agree to
                the preliminary contract terms based on this quote.
              </span>
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Processing…" : "Accept, sign & pay deposit"}
            </button>
          </form>
          <form action={onDeny} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <label className="min-w-[12rem] flex-1 text-sm">
              <span className="mb-1 block font-medium">Deny reason</span>
              <input
                name="reason"
                placeholder="Optional"
                className="w-full rounded-md border border-[var(--line)] px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-60"
            >
              Deny quote
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function CustomerVendorOfferCard({
  offer,
}: {
  offer: CustomerFacingVendorOffer;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDecide(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await decideVendorOfferAction(formData);
      if (!res.ok) setError(res.error ?? "Could not submit decision.");
    });
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{offer.event_name ?? "Vendor package"}</h3>
          <p className="text-sm text-[var(--muted)]">
            Customer-facing package price (vendor cost hidden)
          </p>
        </div>
        <StatusPill tone={offer.status === "sent" ? "warn" : "ok"}>
          {offer.status}
        </StatusPill>
      </div>
      <p className="mt-3 font-[family-name:var(--font-display)] text-2xl">
        {formatCurrency(offer.customer_price)}
      </p>
      {offer.notes ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{offer.notes}</p>
      ) : null}

      {offer.status === "sent" ? (
        <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <form action={onDecide} className="space-y-3">
            <input type="hidden" name="offerId" value={offer.id} />
            <input type="hidden" name="decision" value="accept" />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Type your full legal name to sign off
              </span>
              <input
                name="signerName"
                required
                className="w-full rounded-md border border-[var(--line)] px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Accept & amend contract"}
            </button>
          </form>
          <form action={onDecide}>
            <input type="hidden" name="offerId" value={offer.id} />
            <input type="hidden" name="decision" value="reject" />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-60"
            >
              Reject package
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
