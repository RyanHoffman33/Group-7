import type { AnalyticsEventSlice } from "./rankings";

/** Per-vendor cost-entry health from the ledger (operational cleanliness). */
export type VendorCostHealth = {
  name: string;
  entries: number;
  flagged: number;
  rejected: number;
  spend: number;
};

export type VendorFavorability = {
  label: string;
  /** 0–100 blended score. */
  score: number;
  /** Allocated gross margin $ in the filtered window. */
  margin: number;
  /** Events the vendor appears on in the filtered window. */
  events: number;
  /** Share of cost entries without exception flags (0–1). */
  cleanPct: number;
};

function inPeriod(
  eventMonth: string | null,
  filter: { year: string; quarter: string; month: string },
): boolean {
  if (!eventMonth) {
    return filter.year === "all" && filter.quarter === "all" && filter.month === "all";
  }
  const d = new Date(`${eventMonth.slice(0, 10)}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const q = Math.ceil(mo / 3);
  if (filter.year !== "all" && y !== Number(filter.year)) return false;
  if (filter.quarter !== "all" && q !== Number(filter.quarter)) return false;
  if (filter.month !== "all" && mo !== Number(filter.month)) return false;
  return true;
}

/** Deterministic demo health when live cost_entries are unavailable. */
export function seedVendorHealth(): VendorCostHealth[] {
  return [
    { name: "Premier Catering Co", entries: 40, flagged: 1, rejected: 0, spend: 420000 },
    { name: "StageRight AV", entries: 36, flagged: 2, rejected: 0, spend: 280000 },
    { name: "BrightLight Rentals", entries: 22, flagged: 4, rejected: 1, spend: 95000 },
    { name: "PrintWorks", entries: 18, flagged: 0, rejected: 0, spend: 42000 },
    { name: "Fleet Travel Partners", entries: 15, flagged: 3, rejected: 0, spend: 38000 },
    { name: "Bloom & Branch Florals", entries: 12, flagged: 5, rejected: 1, spend: 28000 },
    { name: "River City Media", entries: 10, flagged: 0, rejected: 0, spend: 22000 },
  ];
}

/**
 * Favorability score (demo): blend of
 * - margin contribution in the filtered window (45%)
 * - cost-entry cleanliness = 1 − flag rate (35%)
 * - event volume in the filtered window (20%)
 * Rejected approvals apply a soft penalty.
 */
export function vendorFavorabilityFromData(
  slices: AnalyticsEventSlice[],
  health: VendorCostHealth[],
  filter: { year: string; quarter: string; month: string },
  n = 5,
): VendorFavorability[] {
  const filtered = slices.filter((s) => inPeriod(s.eventMonth, filter));
  const margins = new Map<string, { margin: number; events: number }>();

  for (const s of filtered) {
    const names = s.vendors.length ? s.vendors : [];
    if (!names.length) continue;
    const share = s.grossMargin / names.length;
    for (const name of names) {
      const row = margins.get(name) ?? { margin: 0, events: 0 };
      row.margin += share;
      row.events += 1;
      margins.set(name, row);
    }
  }

  const healthByName = new Map(health.map((h) => [h.name, h]));
  const names = new Set([...margins.keys(), ...healthByName.keys()]);
  if (!names.size) return [];

  const marginVals = [...margins.values()].map((v) => Math.max(0, v.margin));
  const maxMargin = Math.max(1, ...marginVals);
  const maxEvents = Math.max(
    1,
    ...[...margins.values()].map((v) => v.events),
  );

  const rows: VendorFavorability[] = [];
  for (const name of names) {
    const m = margins.get(name) ?? { margin: 0, events: 0 };
    const h = healthByName.get(name);
    const entries = h?.entries ?? 0;
    const flagged = h?.flagged ?? 0;
    const rejected = h?.rejected ?? 0;
    const cleanPct =
      entries > 0 ? Math.max(0, 1 - flagged / entries) : 0.75;
    const rejectRate = entries > 0 ? rejected / entries : 0;

    const marginNorm = Math.max(0, m.margin) / maxMargin;
    const volumeNorm = m.events / maxEvents;
    const raw =
      0.45 * marginNorm + 0.35 * cleanPct + 0.2 * volumeNorm;
    const score = Math.round(
      Math.min(100, Math.max(0, raw * (1 - 0.4 * rejectRate) * 100)),
    );

    // Need at least margin events or ledger activity to rank.
    if (m.events === 0 && entries === 0) continue;

    rows.push({
      label: name,
      score,
      margin: m.margin,
      events: m.events,
      cleanPct,
    });
  }

  return rows.sort((a, b) => b.score - a.score || b.margin - a.margin).slice(0, n);
}
