export type QuotePackageId = "essential" | "standard" | "premium" | "custom";

export interface ValuationCategoryTotal {
  key: "venue" | "fb" | "av" | "labor" | "contingency";
  label: string;
  low: number;
  mid: number;
  high: number;
}

export interface ValuationRecommendation {
  eventTypeKey: string;
  eventTypeLabel: string;
  guests: number;
  guestBand: string;
  categories: ValuationCategoryTotal[];
  totalLow: number;
  totalMid: number;
  totalHigh: number;
  currentEstimate: number | null;
  varianceVsMid: number | null;
  variancePct: number | null;
  recommendation: string;
  industryNotes: string;
  disclaimer: string;
}

export interface ValuationCase {
  id: string;
  createdAt: string;
  createdBy: string;
  contractId: string | null;
  requestId: string | null;
  eventName: string;
  eventType: string;
  guests: number;
  currentEstimate: number | null;
  changeSummary: string;
  recommendation: ValuationRecommendation;
}

export const QUOTE_PACKAGES: {
  id: QuotePackageId;
  label: string;
  description: string;
  /** Multiplier applied to industry mid total. */
  midMultiplier: number;
}[] = [
  {
    id: "essential",
    label: "Essential",
    description: "Core venue + F&B with lean AV and staffing.",
    midMultiplier: 0.85,
  },
  {
    id: "standard",
    label: "Standard",
    description: "Balanced package aligned to industry mid benchmarks.",
    midMultiplier: 1.0,
  },
  {
    id: "premium",
    label: "Premium",
    description: "Elevated production, F&B, and contingency.",
    midMultiplier: 1.22,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Manual total — use valuation tool to justify.",
    midMultiplier: 1.0,
  },
];
