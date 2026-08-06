import { listMonthlyProfits, listEventProfits } from "@/features/profitability/queries";
import { getDashboardMetrics } from "@/features/billing/queries";
import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_SEED_MONTHS, type AnalyticsMonth } from "./seed";
import { forecastSeries, type ForecastResult } from "./forecast";
import type { AnalyticsEventSlice } from "./rankings";
import { rankingsFromSlices } from "./rankings";
import {
  seedVendorHealth,
  type VendorCostHealth,
} from "./favorability";

export type AnalyticsBundle = {
  history: AnalyticsMonth[];
  forecast: ForecastResult;
  source: "live" | "seed";
  /** Event-level slices for overview quadrants (filterable client-side). */
  eventSlices: AnalyticsEventSlice[];
  /** Cost-entry cleanliness / spend by vendor for favorability scoring. */
  vendorHealth: VendorCostHealth[];
  kpis: {
    trailingRevenue: number;
    trailingMargin: number;
    trailingMarginPct: number;
    avgEvents: number;
    arOutstanding: number;
    revenueGrowthPct: number | null;
  };
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("analytics timeout")), ms),
    ),
  ]);
}

function fromProfitMonths(
  months: Awaited<ReturnType<typeof listMonthlyProfits>>,
  arByMonthFallback: number,
): AnalyticsMonth[] {
  const lastIdx = months.length - 1;
  return months.map((m, i) => ({
    month: m.month.length === 7 ? `${m.month}-01` : m.month.slice(0, 10),
    revenue: m.recognized_revenue,
    cogs: m.direct_cogs,
    margin: m.net_margin,
    events: 0,
    // Point-in-time AR only on the latest month — avoid stamping current AR on history.
    arOutstanding: i === lastIdx ? arByMonthFallback : 0,
  }));
}

async function loadVenuesByContract(
  contractIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!contractIds.length) return map;
  const supabase = createClient();
  const chunkSize = 80;
  for (let i = 0; i < contractIds.length; i += chunkSize) {
    const chunk = contractIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("contracts")
      .select("id, venue_name")
      .in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      map.set(String(row.id), (row.venue_name as string | null) ?? null);
    }
  }
  return map;
}

async function loadVendorsByContract(
  contractIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!contractIds.length) return map;
  const supabase = createClient();
  // Chunk .in() to stay under PostgREST URL limits.
  const chunkSize = 80;
  for (let i = 0; i < contractIds.length; i += chunkSize) {
    const chunk = contractIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("cost_entries")
      .select("contract_id, vendor_name, vendor_id, vendors(name), is_void")
      .in("contract_id", chunk);
    if (error) throw error;

    for (const row of data ?? []) {
      if (row.is_void === true) continue;
      const cid = String(row.contract_id);
      const joined = row.vendors as
        | { name?: string }
        | { name?: string }[]
        | null;
      const vendorFromJoin = Array.isArray(joined)
        ? joined[0]?.name
        : joined?.name;
      const name =
        (row.vendor_name as string | null)?.trim() ||
        vendorFromJoin?.trim() ||
        null;
      if (!name) continue;
      const list = map.get(cid) ?? [];
      if (!list.includes(name)) list.push(name);
      map.set(cid, list);
    }
  }
  return map;
}

function eventMonthKey(iso: string | null): string | null {
  if (!iso) return null;
  return `${iso.slice(0, 7)}-01`;
}

async function loadVendorHealth(): Promise<VendorCostHealth[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cost_entries")
    .select(
      "amount, vendor_name, vendor_id, vendors(name), approval_status, flag_late_entry, flag_duplicate_invoice, flag_over_committed, flag_after_billing, entry_type",
    )
    .eq("entry_type", "vendor_expense");
  if (error) throw error;

  const byName = new Map<
    string,
    { entries: number; flagged: number; rejected: number; spend: number }
  >();

  for (const row of data ?? []) {
    const joined = row.vendors as
      | { name?: string }
      | { name?: string }[]
      | null;
    const vendorFromJoin = Array.isArray(joined)
      ? joined[0]?.name
      : joined?.name;
    const name =
      (row.vendor_name as string | null)?.trim() ||
      vendorFromJoin?.trim() ||
      null;
    if (!name) continue;

    const flagged =
      row.flag_late_entry === true ||
      row.flag_duplicate_invoice === true ||
      row.flag_over_committed === true ||
      row.flag_after_billing === true;
    const cur = byName.get(name) ?? {
      entries: 0,
      flagged: 0,
      rejected: 0,
      spend: 0,
    };
    cur.entries += 1;
    if (flagged) cur.flagged += 1;
    if (row.approval_status === "rejected") cur.rejected += 1;
    cur.spend += Number(row.amount) || 0;
    byName.set(name, cur);
  }

  return [...byName.entries()].map(([name, v]) => ({
    name,
    entries: v.entries,
    flagged: v.flagged,
    rejected: v.rejected,
    spend: v.spend,
  }));
}

async function loadEventSlices(): Promise<AnalyticsEventSlice[]> {
  const events = await listEventProfits();
  if (!events.length) return [];

  const ids = events.map((e) => e.contract_id);
  const [venues, vendors] = await Promise.all([
    loadVenuesByContract(ids),
    loadVendorsByContract(ids),
  ]);

  return events.map((e) => ({
    contractId: e.contract_id,
    customerName: e.customer_name,
    eventType: e.event_type,
    venueName: venues.get(e.contract_id) ?? null,
    eventMonth: eventMonthKey(e.event_start ?? e.event_end),
    grossMargin: e.gross_margin,
    recognizedRevenue: e.recognized_revenue,
    vendors: vendors.get(e.contract_id) ?? [],
  }));
}

/** Deterministic seed slices when live data is unavailable — enough for demo quadrants. */
function seedEventSlices(): AnalyticsEventSlice[] {
  const customers = [
    "Harborview Hospitals",
    "Northstar Financial Group",
    "Prairie Arts Collective",
    "Cedar & Pine Weddings",
    "Lakeside University",
  ];
  const groups = [
    "corporate_conference",
    "trade_show",
    "gala",
    "corporate_event",
    "product_launch",
  ];
  const venues = [
    "MainEvent Venue 1",
    "MainEvent Venue 2",
    "MainEvent Venue 4",
    "MainEvent Venue 5",
    "MainEvent Venue 6",
  ];
  const vendorPool = [
    "Premier Catering Co",
    "StageRight AV",
    "BrightLight Rentals",
    "PrintWorks",
    "Fleet Travel Partners",
  ];

  const slices: AnalyticsEventSlice[] = [];
  let i = 0;
  for (const m of ANALYTICS_SEED_MONTHS) {
    const eventsInMonth = Math.max(1, m.events);
    const marginEach = m.margin / eventsInMonth;
    const revEach = m.revenue / eventsInMonth;
    for (let e = 0; e < eventsInMonth; e++) {
      slices.push({
        contractId: `seed-${i}`,
        customerName: customers[i % customers.length],
        eventType: groups[i % groups.length],
        venueName: venues[i % venues.length],
        eventMonth: m.month,
        grossMargin: Math.round(marginEach * (0.85 + (i % 5) * 0.06)),
        recognizedRevenue: Math.round(revEach),
        vendors: [
          vendorPool[i % vendorPool.length],
          vendorPool[(i + 2) % vendorPool.length],
        ],
      });
      i += 1;
    }
  }
  return slices;
}

async function loadLiveHistory(): Promise<{
  history: AnalyticsMonth[];
  slices: AnalyticsEventSlice[];
  vendorHealth: VendorCostHealth[];
}> {
  const [months, events, metrics, slices, vendorHealth] = await Promise.all([
    listMonthlyProfits(),
    listEventProfits(),
    getDashboardMetrics().catch(() => null),
    loadEventSlices(),
    loadVendorHealth().catch(() => [] as VendorCostHealth[]),
  ]);

  const arOut = metrics?.totalOutstanding ?? 0;

  let history = fromProfitMonths(months, arOut);

  if (events.length) {
    const counts = new Map<string, number>();
    for (const e of events) {
      const start = e.event_start ?? e.event_end;
      if (!start) continue;
      const key = `${start.slice(0, 7)}-01`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    history = history.map((h) => ({
      ...h,
      events: counts.get(h.month) ?? h.events,
    }));
  }

  if (history.length < 3) {
    throw new Error("insufficient live history");
  }
  return {
    history: history.sort((a, b) => a.month.localeCompare(b.month)),
    slices,
    vendorHealth,
  };
}

export async function getAnalyticsBundle(): Promise<AnalyticsBundle> {
  let history: AnalyticsMonth[];
  let eventSlices: AnalyticsEventSlice[];
  let vendorHealth: VendorCostHealth[];
  let source: "live" | "seed" = "seed";

  try {
    const live = await withTimeout(loadLiveHistory(), 4500);
    history = live.history;
    eventSlices = live.slices;
    vendorHealth =
      live.vendorHealth.length > 0 ? live.vendorHealth : seedVendorHealth();
    source = "live";
  } catch {
    history = ANALYTICS_SEED_MONTHS;
    eventSlices = seedEventSlices();
    vendorHealth = seedVendorHealth();
    source = "seed";
  }

  const forecast = forecastSeries(history, 6);
  const last6 = history.slice(-6);
  const prev6 = history.slice(-12, -6);
  const trailingRevenue = last6.reduce((s, m) => s + m.revenue, 0);
  const trailingMargin = last6.reduce((s, m) => s + m.margin, 0);
  const trailingMarginPct =
    trailingRevenue === 0 ? 0 : trailingMargin / trailingRevenue;
  const avgEvents =
    last6.length === 0
      ? 0
      : last6.reduce((s, m) => s + m.events, 0) / last6.length;
  const arOutstanding = history[history.length - 1]?.arOutstanding ?? 0;
  const prevRev = prev6.reduce((s, m) => s + m.revenue, 0);
  const revenueGrowthPct =
    prev6.length && prevRev > 0
      ? (trailingRevenue - prevRev) / prevRev
      : null;

  return {
    history,
    forecast,
    source,
    eventSlices,
    vendorHealth,
    kpis: {
      trailingRevenue,
      trailingMargin,
      trailingMarginPct,
      avgEvents,
      arOutstanding,
      revenueGrowthPct,
    },
  };
}

export type InsightContext = {
  history: AnalyticsMonth[];
  forecast: ForecastResult;
  source: "live" | "seed";
  kpis: AnalyticsBundle["kpis"];
  rankings?: ReturnType<typeof rankingsFromSlices>;
  filterLabel?: string;
};

/** Deterministic offline insights — business-plan ideas from the viewed snapshot. */
export function buildFallbackInsights(
  bundle: AnalyticsBundle | InsightContext,
): string[] {
  const { forecast, kpis, history } = bundle;
  const rankings =
    "rankings" in bundle && bundle.rankings
      ? bundle.rankings
      : "eventSlices" in bundle && bundle.eventSlices
        ? rankingsFromSlices(bundle.eventSlices, {
            year: "all",
            quarter: "all",
            month: "all",
          })
        : null;
  const filterLabel =
    "filterLabel" in bundle && bundle.filterLabel
      ? bundle.filterLabel
      : "all periods";

  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const slope = forecast.revenueSlope;
  const direction =
    slope > 2000 ? "upward" : slope < -2000 ? "downward" : "flat";

  const tips: string[] = [];

  tips.push(
    `Business-plan lens (${filterLabel}): revenue trend is ${direction}. Lean the next planning cycle toward segments already showing the strongest gross margin $, not just top-line bookings.`,
  );

  if (rankings?.customers[0]) {
    const top = rankings.customers[0];
    const share =
      rankings.customers.reduce((s, c) => s + c.margin, 0) > 0
        ? (top.margin /
            rankings.customers.reduce((s, c) => s + c.margin, 0)) *
          100
        : 0;
    tips.push(
      share >= 35
        ? `Customer concentration risk: ${top.label} drives ~${share.toFixed(0)}% of viewed gross margin $. Diversify with lookalike accounts in adjacent industries before locking a multi-year plan.`
        : `Anchor growth on ${top.label} (top customer by gross margin $) while packaging a repeatable offer for the next 2–3 similar accounts.`,
    );
  }

  if (rankings?.eventGroups[0]) {
    const g = rankings.eventGroups[0];
    tips.push(
      `Event mix opportunity: "${g.label}" leads by gross margin $. Staff capacity, vendor retainers, and marketing should prioritize this event group in the next business plan.`,
    );
  }

  if (rankings?.venues[0] && rankings?.vendors[0]) {
    tips.push(
      `Operations play: double down on ${rankings.venues[0].label} and preferred partner ${rankings.vendors[0].label} — both rank highest by associated gross margin $ in the current view.`,
    );
  }

  if (kpis.revenueGrowthPct != null) {
    const g = kpis.revenueGrowthPct * 100;
    tips.push(
      g >= 0
        ? `Trailing half revenue is up ${g.toFixed(1)}% vs the prior half — fund a measured capacity increase (crew + AV) rather than across-the-board hiring.`
        : `Trailing half revenue is down ${Math.abs(g).toFixed(1)}% — freeze discretionary overhead and protect margin on the highest-performing event groups before expanding.`,
    );
  }

  if (kpis.trailingMarginPct < 0.15) {
    tips.push(
      `Blended trailing margin is only ${(kpis.trailingMarginPct * 100).toFixed(1)}% — write a cost-discipline initiative (commitment gates + vendor rate cards) into the plan before chasing volume.`,
    );
  } else if (prev && last && last.revenue > 0 && prev.revenue > 0) {
    const creep = last.cogs / last.revenue - prev.cogs / prev.revenue;
    if (creep > 0.02) {
      tips.push(
        `COGS ratio rose ${(creep * 100).toFixed(1)} pts month-over-month — include a vendor renegotiation sprint in the near-term plan.`,
      );
    }
  }

  if (tips.length < 4 && forecast.points.length >= 2) {
    const next3 = forecast.points.slice(0, 3);
    const nextRev = next3.reduce((s, p) => s + p.revenue, 0);
    tips.push(
      `Near-term outlook: ~$${Math.round(nextRev).toLocaleString()} projected revenue over the next quarter — size inventory and cash reserves to that band, not peak historical months.`,
    );
  }

  return tips.slice(0, 6);
}
