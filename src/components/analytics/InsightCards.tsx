"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalyticsMonth } from "@/features/analytics/seed";
import type { AnalyticsRankings } from "@/features/analytics/rankings";

export type InsightRequestContext = {
  filterLabel: string;
  rankings: AnalyticsRankings;
  history: AnalyticsMonth[];
  kpis: {
    yoyRevenueGrowthPct: number | null;
    avgMarginPct: number;
    topCustomerSharePct: number | null;
    topCustomerName: string | null;
  };
};

export function InsightCards({
  initialInsights,
  context,
}: {
  initialInsights: string[];
  /** Optional overview context sent to the insights API for filter-aware advice. */
  context?: InsightRequestContext;
}) {
  const [insights, setInsights] = useState(initialInsights);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"fallback" | "gemini" | "cache">(
    "fallback",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context ? { context } : {}),
      });
      const data = (await res.json()) as {
        insights?: string[];
        source?: "fallback" | "gemini";
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not refresh insights.");
        return;
      }
      if (data.insights?.length) {
        setInsights(data.insights);
        setSource(data.source ?? "fallback");
      }
    } catch {
      setError("Network error refreshing insights.");
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    setInsights(initialInsights);
  }, [initialInsights]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          {source === "gemini"
            ? "Generated with Gemini from the analytics view you are looking at"
            : "Rule-based briefing (Gemini unavailable or not yet refreshed)"}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f9fb] disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh AI summary"}
        </button>
      </div>
      {error ? (
        <p className="mb-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      <ul className="space-y-2">
        {insights.map((text) => (
          <li
            key={text.slice(0, 48)}
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)]"
          >
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
