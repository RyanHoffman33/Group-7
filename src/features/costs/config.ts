/** Costs at or above this amount require manager approval (any category). */
export const APPROVAL_THRESHOLD = 2500;

/** Demo default hourly rate when employee profile rate is not available. */
export const DEFAULT_LABOR_RATE = 60;

/**
 * Commitment variance trigger: overage must exceed the *smaller* of
 * 15% of committed amount and $500. That keeps small commitments
 * percentage-sensitive and caps large commitments at a $500 absolute gap.
 */
export const COMMITMENT_VARIANCE_PCT = 0.15;
export const COMMITMENT_VARIANCE_DOLLAR_CAP = 500;

export function commitmentVarianceThreshold(committedAmount: number): number {
  return Math.min(
    COMMITMENT_VARIANCE_PCT * committedAmount,
    COMMITMENT_VARIANCE_DOLLAR_CAP,
  );
}

/** True when actual exceeds committed by more than min(15%, $500). */
export function exceedsCommitmentVariance(
  committedAmount: number,
  actualAmount: number,
): boolean {
  if (!(committedAmount > 0)) return false;
  const overage = actualAmount - committedAmount;
  if (overage <= 0) return false;
  return overage > commitmentVarianceThreshold(committedAmount);
}

/**
 * ACCY 5.4 Cost & Resource Tracking categories.
 * Each maps to contract/event profitability analysis.
 */
export const COST_CATEGORIES = [
  "labor",
  "payroll",
  "contractor",
  "materials",
  "equipment",
  "vendor",
  "advertising",
  "travel",
  "reimbursable",
  "replacement_parts",
  "allocated",
  "other",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

/** Human-readable labels for forms, filters, and dashboards. */
export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  labor: "Employee labor",
  payroll: "Payroll-related costs",
  contractor: "Contractor / subcontractor",
  materials: "Materials",
  equipment: "Equipment usage",
  vendor: "Vendor charges",
  advertising: "Advertising expenditures",
  travel: "Travel",
  reimbursable: "Reimbursable expenses",
  replacement_parts: "Replacement parts",
  allocated: "Allocated costs",
  other: "Other direct costs",
};

/** Categories entered via the vendor/expense form (not the time clock). */
export const EXPENSE_CATEGORIES = COST_CATEGORIES.filter(
  (c) => c !== "labor",
) as Exclude<CostCategory, "labor">[];

export function categoryLabel(category: string): string {
  return (
    COST_CATEGORY_LABELS[category as CostCategory] ??
    category.replaceAll("_", " ")
  );
}
