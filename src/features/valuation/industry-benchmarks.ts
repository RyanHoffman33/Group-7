/** Illustrative industry-informed demo benchmarks (not a live data feed). */

export type GuestBand = "small" | "medium" | "large" | "xlarge";

export interface CategoryRange {
  low: number;
  mid: number;
  high: number;
}

export interface EventTypeBenchmark {
  eventTypeKey: string;
  label: string;
  /** Per-guest category ranges in USD (demo, MPI/PCMA-informed approximations). */
  perGuest: {
    venue: CategoryRange;
    fb: CategoryRange;
    av: CategoryRange;
    labor: CategoryRange;
  };
  contingencyPct: number;
  notes: string;
}

export function guestBandForCount(guests: number): GuestBand {
  if (guests < 75) return "small";
  if (guests < 200) return "medium";
  if (guests < 450) return "large";
  return "xlarge";
}

/** Band multiplier vs per-guest mid (larger events get slight economies). */
export function bandMultiplier(band: GuestBand): number {
  switch (band) {
    case "small":
      return 1.12;
    case "medium":
      return 1.0;
    case "large":
      return 0.94;
    case "xlarge":
      return 0.88;
  }
}

export const INDUSTRY_BENCHMARKS: EventTypeBenchmark[] = [
  {
    eventTypeKey: "corporate_conference",
    label: "Corporate conference",
    perGuest: {
      venue: { low: 45, mid: 75, high: 120 },
      fb: { low: 55, mid: 95, high: 160 },
      av: { low: 25, mid: 45, high: 85 },
      labor: { low: 30, mid: 50, high: 80 },
    },
    contingencyPct: 0.1,
    notes: "Day conferences typically allocate more to AV and facilitation labor.",
  },
  {
    eventTypeKey: "product_launch",
    label: "Product launch",
    perGuest: {
      venue: { low: 50, mid: 90, high: 150 },
      fb: { low: 60, mid: 110, high: 180 },
      av: { low: 40, mid: 80, high: 140 },
      labor: { low: 35, mid: 60, high: 95 },
    },
    contingencyPct: 0.12,
    notes: "Launches skew higher on production/AV and creative staffing.",
  },
  {
    eventTypeKey: "wedding",
    label: "Wedding",
    perGuest: {
      venue: { low: 40, mid: 85, high: 160 },
      fb: { low: 80, mid: 140, high: 220 },
      av: { low: 15, mid: 35, high: 70 },
      labor: { low: 25, mid: 45, high: 75 },
    },
    contingencyPct: 0.08,
    notes: "F&B often dominates wedding budgets in metro markets.",
  },
  {
    eventTypeKey: "gala",
    label: "Gala",
    perGuest: {
      venue: { low: 55, mid: 100, high: 175 },
      fb: { low: 90, mid: 160, high: 250 },
      av: { low: 30, mid: 55, high: 100 },
      labor: { low: 35, mid: 55, high: 90 },
    },
    contingencyPct: 0.1,
    notes: "Galas carry premium F&B and décor-driven labor.",
  },
  {
    eventTypeKey: "fundraiser",
    label: "Fundraiser",
    perGuest: {
      venue: { low: 35, mid: 70, high: 120 },
      fb: { low: 50, mid: 95, high: 160 },
      av: { low: 20, mid: 40, high: 75 },
      labor: { low: 25, mid: 45, high: 70 },
    },
    contingencyPct: 0.09,
    notes: "Nonprofit fundraisers often target mid-tier packages with strong AV for speakers.",
  },
  {
    eventTypeKey: "holiday_party",
    label: "Holiday party",
    perGuest: {
      venue: { low: 35, mid: 65, high: 110 },
      fb: { low: 55, mid: 100, high: 170 },
      av: { low: 15, mid: 30, high: 55 },
      labor: { low: 20, mid: 40, high: 65 },
    },
    contingencyPct: 0.08,
    notes: "Holiday parties emphasize F&B and entertainment over heavy AV.",
  },
  {
    eventTypeKey: "trade_show",
    label: "Trade show",
    perGuest: {
      venue: { low: 40, mid: 70, high: 115 },
      fb: { low: 35, mid: 60, high: 100 },
      av: { low: 30, mid: 55, high: 95 },
      labor: { low: 40, mid: 70, high: 110 },
    },
    contingencyPct: 0.11,
    notes: "Exhibitor logistics and floor labor drive trade-show cost profiles.",
  },
  {
    eventTypeKey: "concert",
    label: "Concert",
    perGuest: {
      venue: { low: 30, mid: 55, high: 100 },
      fb: { low: 20, mid: 40, high: 70 },
      av: { low: 45, mid: 90, high: 160 },
      labor: { low: 35, mid: 65, high: 105 },
    },
    contingencyPct: 0.12,
    notes: "Production and stage AV dominate concert-style events.",
  },
  {
    eventTypeKey: "celebration",
    label: "Celebration",
    perGuest: {
      venue: { low: 35, mid: 70, high: 125 },
      fb: { low: 60, mid: 110, high: 180 },
      av: { low: 15, mid: 30, high: 60 },
      labor: { low: 20, mid: 40, high: 70 },
    },
    contingencyPct: 0.08,
    notes: "Private celebrations track close to wedding F&B patterns at smaller scale.",
  },
  {
    eventTypeKey: "corporate_event",
    label: "Corporate event",
    perGuest: {
      venue: { low: 40, mid: 75, high: 130 },
      fb: { low: 50, mid: 90, high: 150 },
      av: { low: 25, mid: 45, high: 80 },
      labor: { low: 30, mid: 50, high: 80 },
    },
    contingencyPct: 0.1,
    notes: "General corporate events sit between conference and gala profiles.",
  },
];

export function findBenchmark(eventTypeKeyOrLabel: string): EventTypeBenchmark {
  const raw = eventTypeKeyOrLabel.trim().toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const hit =
    INDUSTRY_BENCHMARKS.find(
      (b) =>
        b.eventTypeKey === slug ||
        b.label.toLowerCase() === raw ||
        b.eventTypeKey.includes(slug) ||
        slug.includes(b.eventTypeKey),
    ) ?? INDUSTRY_BENCHMARKS.find((b) => b.eventTypeKey === "corporate_event")!;
  return hit;
}
