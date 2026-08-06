/** Client-side top-N aggregations for Analytics overview quadrants. */

export type RankedEntity = {
  label: string;
  /** Gross margin $ (sum). */
  margin: number;
  count: number;
};

export type AnalyticsEventSlice = {
  contractId: string;
  customerName: string;
  eventType: string | null;
  venueName: string | null;
  /** YYYY-MM-01 or null */
  eventMonth: string | null;
  grossMargin: number;
  recognizedRevenue: number;
  /** Distinct vendor names tied to this contract via cost_entries. */
  vendors: string[];
};

export type AnalyticsRankings = {
  vendors: RankedEntity[];
  eventGroups: RankedEntity[];
  customers: RankedEntity[];
  venues: RankedEntity[];
};

function prettyLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function topN(
  map: Map<string, { margin: number; count: number }>,
  n: number,
  formatLabel: (k: string) => string = (k) => k,
): RankedEntity[] {
  return [...map.entries()]
    .map(([key, v]) => ({
      label: formatLabel(key),
      margin: v.margin,
      count: v.count,
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, n);
}

function inPeriod(
  eventMonth: string | null,
  filter: { year: string; quarter: string; month: string },
): boolean {
  if (!eventMonth) return filter.year === "all" && filter.quarter === "all" && filter.month === "all";
  const d = new Date(`${eventMonth.slice(0, 10)}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const q = Math.ceil(mo / 3);
  if (filter.year !== "all" && y !== Number(filter.year)) return false;
  if (filter.quarter !== "all" && q !== Number(filter.quarter)) return false;
  if (filter.month !== "all" && mo !== Number(filter.month)) return false;
  return true;
}

/** Aggregate top-5 rankings from event slices (respects year/quarter/month filter). */
export function rankingsFromSlices(
  slices: AnalyticsEventSlice[],
  filter: { year: string; quarter: string; month: string },
  n = 5,
): AnalyticsRankings {
  const filtered = slices.filter((s) => inPeriod(s.eventMonth, filter));

  const customers = new Map<string, { margin: number; count: number }>();
  const groups = new Map<string, { margin: number; count: number }>();
  const venues = new Map<string, { margin: number; count: number }>();
  /** Vendor → allocated gross margin $ (event margin × vendor spend share proxy: equal split among vendors on event). */
  const vendors = new Map<string, { margin: number; count: number }>();

  for (const s of filtered) {
    const cust = s.customerName || "Unknown customer";
    const c = customers.get(cust) ?? { margin: 0, count: 0 };
    c.margin += s.grossMargin;
    c.count += 1;
    customers.set(cust, c);

    const group = s.eventType?.trim() || "Unspecified";
    const g = groups.get(group) ?? { margin: 0, count: 0 };
    g.margin += s.grossMargin;
    g.count += 1;
    groups.set(group, g);

    const venue = s.venueName?.trim() || "Unspecified";
    const v = venues.get(venue) ?? { margin: 0, count: 0 };
    v.margin += s.grossMargin;
    v.count += 1;
    venues.set(venue, v);

    const names = s.vendors.length ? s.vendors : [];
    if (names.length === 0) continue;
    const share = s.grossMargin / names.length;
    for (const name of names) {
      const row = vendors.get(name) ?? { margin: 0, count: 0 };
      row.margin += share;
      row.count += 1;
      vendors.set(name, row);
    }
  }

  return {
    vendors: topN(vendors, n),
    eventGroups: topN(groups, n, prettyLabel),
    customers: topN(customers, n),
    venues: topN(venues, n),
  };
}

export type OverviewKpis = {
  /** YoY revenue growth (selected year vs prior, or trailing 12 vs prior 12). */
  yoyRevenueGrowthPct: number | null;
  yoyRevenueHint: string;
  /** YoY change in margin % points. */
  yoyMarginChangePts: number | null;
  yoyMarginHint: string;
  /** Share of gross margin from the single largest customer. */
  topCustomerSharePct: number | null;
  topCustomerName: string | null;
  /** Blended average margin % in view. */
  avgMarginPct: number;
  avgMarginHint: string;
  /** YoY event count growth. */
  eventCountGrowthPct: number | null;
  eventCountHint: string;
};

function yearTotals(
  history: { month: string; revenue: number; margin: number; events: number }[],
  year: number,
) {
  const rows = history.filter(
    (m) => new Date(`${m.month}T00:00:00Z`).getUTCFullYear() === year,
  );
  const revenue = rows.reduce((s, m) => s + m.revenue, 0);
  const margin = rows.reduce((s, m) => s + m.margin, 0);
  const events = rows.reduce((s, m) => s + m.events, 0);
  return {
    revenue,
    margin,
    events,
    marginPct: revenue > 0 ? margin / revenue : 0,
    months: rows.length,
  };
}

/** Demo-friendly overview KPIs with soft labels computed from monthly history + rankings. */
export function overviewKpisFromData(
  history: { month: string; revenue: number; margin: number; events: number }[],
  rankings: AnalyticsRankings,
  filter: { year: string; quarter: string; month: string },
): OverviewKpis {
  const years = [
    ...new Set(
      history.map((m) => new Date(`${m.month}T00:00:00Z`).getUTCFullYear()),
    ),
  ].sort((a, b) => a - b);

  let focusYear: number | null = null;
  let priorYear: number | null = null;

  if (filter.year !== "all") {
    focusYear = Number(filter.year);
    priorYear = focusYear - 1;
  } else if (years.length >= 2) {
    focusYear = years[years.length - 1];
    priorYear = years[years.length - 2];
  }

  let yoyRevenueGrowthPct: number | null = null;
  let yoyMarginChangePts: number | null = null;
  let eventCountGrowthPct: number | null = null;
  let yoyRevenueHint = "Need two years of history";
  let yoyMarginHint = "Need two years of history";
  let eventCountHint = "Need two years of history";

  if (focusYear != null && priorYear != null) {
    const cur = yearTotals(history, focusYear);
    const prev = yearTotals(history, priorYear);
    if (prev.revenue > 0 && cur.months > 0 && prev.months > 0) {
      yoyRevenueGrowthPct = (cur.revenue - prev.revenue) / prev.revenue;
      yoyRevenueHint = `${focusYear} vs ${priorYear}`;
    }
    if (prev.months > 0 && cur.months > 0) {
      yoyMarginChangePts = (cur.marginPct - prev.marginPct) * 100;
      yoyMarginHint = `Margin % ${focusYear} vs ${priorYear}`;
    }
    if (prev.events > 0 && cur.months > 0 && prev.months > 0) {
      eventCountGrowthPct = (cur.events - prev.events) / prev.events;
      eventCountHint = `${cur.events} events in ${focusYear} vs ${prev.events} in ${priorYear}`;
    }
  }

  // Filtered window for avg margin
  const filtered =
    filter.year === "all" && filter.quarter === "all" && filter.month === "all"
      ? history
      : history.filter((m) => {
          const d = new Date(`${m.month}T00:00:00Z`);
          const y = d.getUTCFullYear();
          const mo = d.getUTCMonth() + 1;
          const q = Math.ceil(mo / 3);
          if (filter.year !== "all" && y !== Number(filter.year)) return false;
          if (filter.quarter !== "all" && q !== Number(filter.quarter)) return false;
          if (filter.month !== "all" && mo !== Number(filter.month)) return false;
          return true;
        });

  const view = filtered.length ? filtered : history;
  const rev = view.reduce((s, m) => s + m.revenue, 0);
  const mar = view.reduce((s, m) => s + m.margin, 0);
  const avgMarginPct = rev > 0 ? mar / rev : 0;

  const topCustomer = rankings.customers[0] ?? null;
  const totalCustomerMargin = rankings.customers.reduce((s, c) => s + c.margin, 0);
  const topCustomerSharePct =
    topCustomer && totalCustomerMargin > 0
      ? topCustomer.margin / totalCustomerMargin
      : null;

  return {
    yoyRevenueGrowthPct,
    yoyRevenueHint,
    yoyMarginChangePts,
    yoyMarginHint,
    topCustomerSharePct,
    topCustomerName: topCustomer?.label ?? null,
    avgMarginPct,
    avgMarginHint: "Blended margin in filtered months",
    eventCountGrowthPct,
    eventCountHint,
  };
}
