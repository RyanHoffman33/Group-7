"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createQuoteForRequestAction,
  returnQuoteToCustomerAction,
} from "@/features/requests/actions";
import type { EventRequest } from "@/features/requests/types";
import { QUOTE_PACKAGES } from "@/features/valuation/types";
import { ValuationToolClient } from "@/components/valuation/ValuationToolClient";

export function RequestDetailClient({
  request,
  canWrite,
}: {
  request: EventRequest;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [packageId, setPackageId] = useState("standard");
  const [customAmount, setCustomAmount] = useState("");
  const [notes, setNotes] = useState(request.quote?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <Link
          href="/contracts/requests"
          className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
        >
          ← All requests
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          {request.eventName}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {request.organization} · {request.contactName} ·{" "}
          {request.contactEmail}
          {request.contactPhone ? ` · ${request.contactPhone}` : ""}
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 text-sm sm:grid-cols-2">
        <p>
          <span className="text-[var(--muted)]">Type:</span> {request.eventType}
        </p>
        <p>
          <span className="text-[var(--muted)]">Preferred date:</span>{" "}
          {request.preferredDate}
        </p>
        <p>
          <span className="text-[var(--muted)]">Guests:</span>{" "}
          {request.estimatedGuests}
        </p>
        <p>
          <span className="text-[var(--muted)]">Budget:</span>{" "}
          {request.budgetRange}
        </p>
        <p>
          <span className="text-[var(--muted)]">Venue:</span>{" "}
          {request.venuePreference}
        </p>
        <p>
          <span className="text-[var(--muted)]">Status:</span>{" "}
          <span className="capitalize">{request.status.replace(/_/g, " ")}</span>
        </p>
        <p className="sm:col-span-2">
          <span className="text-[var(--muted)]">Message to team:</span>{" "}
          {request.messageToTeam}
        </p>
      </section>

      {canWrite ? (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Create contract estimate / quote
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Choose a package tier (industry mid × package multiplier). Then
            return the quote to the customer portal.
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const fd = new FormData();
              fd.set("requestId", request.id);
              fd.set("packageId", packageId);
              fd.set("customAmount", customAmount);
              fd.set("notes", notes);
              start(async () => {
                const r = await createQuoteForRequestAction(fd);
                if (!r.ok) setError(r.error ?? "Failed");
                else router.refresh();
              });
            }}
          >
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Package</span>
              <select
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              >
                {QUOTE_PACKAGES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.description}
                  </option>
                ))}
              </select>
            </label>
            {packageId === "custom" ? (
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Custom amount</span>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Notes to customer</span>
              <textarea
                rows={3}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save quote"}
              </button>
              {request.quote ? (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-medium disabled:opacity-60"
                  onClick={() => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("requestId", request.id);
                    start(async () => {
                      const r = await returnQuoteToCustomerAction(fd);
                      if (!r.ok) setError(r.error ?? "Failed");
                      else router.refresh();
                    });
                  }}
                >
                  Return quote to customer
                </button>
              ) : null}
              <Link
                href={`/contracts/new`}
                className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-medium"
              >
                Draft contract
              </Link>
            </div>
          </form>
          {request.quote ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Current quote:{" "}
              <strong className="text-[var(--ink)]">
                ${request.quote.amount.toLocaleString()}
              </strong>{" "}
              ({request.quote.packageLabel})
              {request.quote.returnedAt
                ? ` · returned ${new Date(request.quote.returnedAt).toLocaleString()}`
                : " · not yet returned"}
            </p>
          ) : null}
        </section>
      ) : null}

      <ValuationToolClient
        compact
        initialEventType={request.eventType}
        initialGuests={request.estimatedGuests}
        requestId={request.id}
        eventName={request.eventName}
      />
    </div>
  );
}
