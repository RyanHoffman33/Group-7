import type { AgingBucket } from "@/lib/supabase/types";

export const AGING_BUCKETS: AgingBucket[] = [
  "current",
  "1-30",
  "31-60",
  "61-90",
  "90+",
];

export function daysPastDue(dueDate: string, asOf: Date = new Date()): number {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date(asOf.toISOString().slice(0, 10) + "T00:00:00");
  const ms = today.getTime() - due.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function bucketFromDaysPastDue(dpd: number): AgingBucket {
  if (dpd <= 0) return "current";
  if (dpd <= 30) return "1-30";
  if (dpd <= 60) return "31-60";
  if (dpd <= 90) return "61-90";
  return "90+";
}

export function agingBucket(dueDate: string, asOf?: Date): AgingBucket {
  return bucketFromDaysPastDue(daysPastDue(dueDate, asOf));
}

/** Portfolio default collection probabilities by aging bucket (ACCY-defensible priors). */
export const PORTFOLIO_DEFAULT_P: Record<AgingBucket, number> = {
  current: 0.98,
  "1-30": 0.92,
  "31-60": 0.82,
  "61-90": 0.68,
  "90+": 0.45,
};

/**
 * Blend customer empirical survival with portfolio defaults.
 * Fully personalized when sample_size >= 3.
 */
export function collectionProbability(
  bucket: AgingBucket,
  stats: {
    sample_size: number;
    bucket_survival: Record<string, number> | null;
  } | null,
): number {
  const portfolio = PORTFOLIO_DEFAULT_P[bucket];
  if (!stats || stats.sample_size <= 0) return portfolio;

  const empirical =
    stats.bucket_survival?.[bucket] ??
    stats.bucket_survival?.[String(bucket)] ??
    null;

  if (empirical == null) return portfolio;

  const weight = Math.min(1, stats.sample_size / 3);
  return portfolio * (1 - weight) + empirical * weight;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );
}

export function formatLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
