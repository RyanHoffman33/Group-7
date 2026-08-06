"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { runValuationAction } from "@/features/valuation/actions";
import type { ValuationRecommendation } from "@/features/valuation/types";
import { INDUSTRY_BENCHMARKS } from "@/features/valuation/industry-benchmarks";
import { listEventTypes } from "@/features/contracts/event-types";

function money(n: number) {
  return `$${n.toLocaleString()}`;
}

export function ValuationToolClient({
  initialEventType = "corporate_conference",
  initialGuests = 150,
  initialEstimate = "",
  contractId = null,
  requestId = null,
  eventName = "",
  compact = false,
}: {
  initialEventType?: string;
  initialGuests?: number;
  initialEstimate?: string;
  contractId?: string | null;
  requestId?: string | null;
  eventName?: string;
  compact?: boolean;
}) {
  const eventTypes = useMemo(() => listEventTypes(), []);
  const [eventType, setEventType] = useState(initialEventType);
  const [guests, setGuests] = useState(String(initialGuests));
  const [estimate, setEstimate] = useState(initialEstimate);
  const [changeSummary, setChangeSummary] = useState("");
  const [result, setResult] = useState<ValuationRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(persist: boolean) {
    setError(null);
    start(async () => {
      const r = await runValuationAction({
        eventType,
        guests: Number(guests),
        currentEstimate: estimate.trim() ? Number(estimate) : null,
        changeSummary,
        contractId,
        requestId,
        eventName: eventName || undefined,
        persist,
      });
      if (!r.ok) {
        setError(r.error);
        setResult(null);
        return;
      }
      setResult(r.recommendation);
    });
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {!compact ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Industry-informed demo
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            Contract valuation
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Re-evaluate an estimate when a customer notifies potential changes.
            Benchmarks approximate published event-cost ranges for planning —
            not a live market feed.
          </p>
        </div>
      ) : (
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
          Valuation assistant
        </h2>
      )}

      <div className="grid gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Event type</span>
          <select
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
            {INDUSTRY_BENCHMARKS.filter(
              (b) => !eventTypes.some((t) => t.value === b.eventTypeKey),
            ).map((b) => (
              <option key={b.eventTypeKey} value={b.eventTypeKey}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Estimated guests</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">
            Current estimate (optional)
          </span>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            placeholder="Existing contract / quote amount"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium">
            Customer change notification
          </span>
          <textarea
            rows={3}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="e.g. Guest count up 80; add evening AV package"
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(false)}
            className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Calculating…" : "Run valuation"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(true)}
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Save case
          </button>
          {!compact ? (
            <Link
              href="/contracts/new"
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-medium"
            >
              Draft contract
            </Link>
          ) : null}
        </div>
        {error ? (
          <p className="text-sm text-[var(--danger)] sm:col-span-2">{error}</p>
        ) : null}
      </div>

      {result ? (
        <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {result.eventTypeLabel} · {result.guests} guests ·{" "}
                {result.guestBand} band
              </p>
              <p className="mt-1 text-sm text-[var(--ink)]">
                {result.recommendation}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-[var(--muted)]">Recommended range</p>
              <p className="font-semibold text-[var(--ink)]">
                {money(result.totalLow)} – {money(result.totalHigh)}
              </p>
              <p className="text-[var(--muted)]">
                Mid anchor {money(result.totalMid)}
              </p>
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2 font-medium">Category</th>
                <th className="py-2 font-medium">Low</th>
                <th className="py-2 font-medium">Mid</th>
                <th className="py-2 font-medium">High</th>
              </tr>
            </thead>
            <tbody>
              {result.categories.map((c) => (
                <tr key={c.key} className="border-b border-[var(--line)]/60">
                  <td className="py-2">{c.label}</td>
                  <td className="py-2">{money(c.low)}</td>
                  <td className="py-2">{money(c.mid)}</td>
                  <td className="py-2">{money(c.high)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-[var(--muted)]">{result.industryNotes}</p>
          <p className="text-xs text-[var(--muted)]">{result.disclaimer}</p>
        </div>
      ) : null}
    </div>
  );
}
