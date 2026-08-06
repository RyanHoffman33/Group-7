import {
  bandMultiplier,
  findBenchmark,
  guestBandForCount,
} from "./industry-benchmarks";
import type { ValuationCategoryTotal, ValuationRecommendation } from "./types";

export function buildValuationRecommendation(input: {
  eventType: string;
  guests: number;
  currentEstimate?: number | null;
  changeSummary?: string;
}): ValuationRecommendation {
  const guests = Math.max(1, Math.round(input.guests) || 1);
  const bench = findBenchmark(input.eventType);
  const band = guestBandForCount(guests);
  const mult = bandMultiplier(band);

  const scale = (n: number) => Math.round(n * guests * mult);

  const categories: ValuationCategoryTotal[] = [
    {
      key: "venue",
      label: "Venue & facilities",
      low: scale(bench.perGuest.venue.low),
      mid: scale(bench.perGuest.venue.mid),
      high: scale(bench.perGuest.venue.high),
    },
    {
      key: "fb",
      label: "Food & beverage",
      low: scale(bench.perGuest.fb.low),
      mid: scale(bench.perGuest.fb.mid),
      high: scale(bench.perGuest.fb.high),
    },
    {
      key: "av",
      label: "AV / production",
      low: scale(bench.perGuest.av.low),
      mid: scale(bench.perGuest.av.mid),
      high: scale(bench.perGuest.av.high),
    },
    {
      key: "labor",
      label: "Labor & staffing",
      low: scale(bench.perGuest.labor.low),
      mid: scale(bench.perGuest.labor.mid),
      high: scale(bench.perGuest.labor.high),
    },
  ];

  const sum = (pick: "low" | "mid" | "high") =>
    categories.reduce((acc, c) => acc + c[pick], 0);

  const baseLow = sum("low");
  const baseMid = sum("mid");
  const baseHigh = sum("high");

  const contingency: ValuationCategoryTotal = {
    key: "contingency",
    label: `Contingency (${Math.round(bench.contingencyPct * 100)}%)`,
    low: Math.round(baseLow * bench.contingencyPct),
    mid: Math.round(baseMid * bench.contingencyPct),
    high: Math.round(baseHigh * bench.contingencyPct),
  };
  categories.push(contingency);

  const totalLow = baseLow + contingency.low;
  const totalMid = baseMid + contingency.mid;
  const totalHigh = baseHigh + contingency.high;

  const current =
    input.currentEstimate != null && Number.isFinite(input.currentEstimate)
      ? Number(input.currentEstimate)
      : null;
  const varianceVsMid = current != null ? totalMid - current : null;
  const variancePct =
    current != null && current !== 0
      ? ((totalMid - current) / current) * 100
      : null;

  let recommendation: string;
  if (current == null) {
    recommendation = `Use the mid estimate of $${totalMid.toLocaleString()} as the quoting anchor for ${guests} guests (${band} band), then adjust package tier.`;
  } else if (variancePct != null && Math.abs(variancePct) < 8) {
    recommendation = `Current estimate ($${current.toLocaleString()}) is within ~8% of industry mid. Keep pricing unless scope changed.`;
  } else if (varianceVsMid != null && varianceVsMid > 0) {
    recommendation = `Industry mid suggests ~$${totalMid.toLocaleString()} — about $${Math.abs(varianceVsMid).toLocaleString()} above the current estimate. Consider a change order or revised quote.`;
  } else {
    recommendation = `Current estimate ($${current!.toLocaleString()}) sits above industry mid ($${totalMid.toLocaleString()}). Validate premium scope before returning a higher quote.`;
  }

  if (input.changeSummary?.trim()) {
    recommendation += ` Change note: ${input.changeSummary.trim()}`;
  }

  return {
    eventTypeKey: bench.eventTypeKey,
    eventTypeLabel: bench.label,
    guests,
    guestBand: band,
    categories,
    totalLow,
    totalMid,
    totalHigh,
    currentEstimate: current,
    varianceVsMid,
    variancePct,
    recommendation,
    industryNotes: bench.notes,
    disclaimer:
      "Demo benchmarks approximate published industry ranges for planning only — not a live market feed or formal appraisal.",
  };
}
