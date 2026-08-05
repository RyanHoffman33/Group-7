/**
 * MainEvent Contracts & Engagements — product decisions (Gabriel-Housey).
 *
 * Locked with product owner discretion (2026-08):
 * 1. Billable when a mid-sized event producer would bill.
 * 2. Required deposit % = of net contract_value (after commercial discount), unless minimum_deposit_amount is set.
 * 3. Approver identity waits on Brandon Users & Roles — soft actor labels only until then.
 * 4. Change orders: Contracts owns commercial CO workflow; Compliance owns recognition treat/apply UX.
 *    Same table (contract_modifications). Apply updates value via approved accounting path.
 * 5. Milestone sum-to-value: fixed_price & milestone (and deposit-heavy fixed) must reconcile;
 *    hourly / T&M / cost_plus / reimbursable are estimate schedules (soft warning only).
 * 6. Seed statuses may be varied for realistic demos.
 */

export const CONTRACT_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "deposit_pending",
  "active",
  "completed",
  "canceled",
  "closed",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** Invoice charge kinds Contracts may authorize for Billing. */
export type BillableChargeKind =
  | "deposit"
  | "milestone"
  | "progress"
  | "recurring"
  | "final"
  | "time_and_materials"
  | "change_order"
  | "cancellation_fee";

export type ContractBillingSlice = {
  status: string;
  deposit_required: boolean;
  deposit_percent: number;
  original_contract_value: number;
  contract_value: number;
  minimum_deposit_amount?: number | null;
  requires_deposit_before_work?: boolean | null;
  billing_method?: string | null;
  performance_complete?: boolean | null;
};

const OPEN_WORK_STATUSES: ContractStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "deposit_pending",
  "active",
];

const EDITABLE_FINANCIAL_STATUSES: ContractStatus[] = ["draft"];

/**
 * Cash counts toward deposit fulfillment: unearned + applied (not refunded).
 * Percentage deposits use net/current contract_value (after commercial discount).
 * Fixed deposits use minimum_deposit_amount when set.
 */
export function requiredDepositAmount(c: ContractBillingSlice): number {
  if (!c.deposit_required) return 0;
  if (c.minimum_deposit_amount != null && c.minimum_deposit_amount > 0) {
    return Number(c.minimum_deposit_amount);
  }
  const base = Number(c.contract_value || c.original_contract_value || 0);
  const pct = Number(c.deposit_percent || 0);
  return Math.round(base * (pct / 100) * 100) / 100;
}

export function isDepositSatisfied(
  c: ContractBillingSlice,
  depositsReceivedTotal: number,
): boolean {
  if (!c.deposit_required) return true;
  return Number(depositsReceivedTotal || 0) + 1e-9 >= requiredDepositAmount(c);
}

/**
 * Event-production billable map (does not recognize revenue).
 *
 * - Deposit invoice: after PM approve (approved / deposit_pending) when deposit required.
 * - Production progress / milestones / T&M: once active (work authorized) or completed.
 * - Final / closeout invoice: completed (or active if performance_complete already true).
 * - Cancellation fee: canceled.
 * - Never bill: draft, pending_approval (except no charges at all).
 */
export function canBillChargeKind(
  status: string,
  kind: BillableChargeKind,
  opts?: { performanceComplete?: boolean },
): boolean {
  const s = status as ContractStatus;
  switch (kind) {
    case "deposit":
      return s === "approved" || s === "deposit_pending" || s === "active";
    case "milestone":
    case "progress":
    case "recurring":
    case "time_and_materials":
    case "change_order":
      return s === "active" || s === "completed";
    case "final":
      return (
        s === "completed" ||
        (s === "active" && Boolean(opts?.performanceComplete))
      );
    case "cancellation_fee":
      return s === "canceled";
    default:
      return false;
  }
}

/** Work / crew spend should not start until Active (and deposit rules satisfied in app). */
export function canStartWork(status: string): boolean {
  return status === "active" || status === "completed";
}

export function canEditCommercialTerms(status: string): boolean {
  return EDITABLE_FINANCIAL_STATUSES.includes(status as ContractStatus);
}

export function canSubmitForApproval(status: string): boolean {
  return status === "draft";
}

/** Soft gate until Brandon ships Users & Roles. */
export function assertCanApproveContract(input: {
  actorLabel: string;
  actorRole?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.actorLabel?.trim()) {
    return { ok: false, reason: "Approver name is required." };
  }
  // Until Brandon: accept any labeled internal actor. Role hint is optional audit metadata.
  const role = (input.actorRole || "").toLowerCase();
  if (role && ["customer", "client", "vendor"].includes(role)) {
    return {
      ok: false,
      reason: "Customers and vendors cannot approve contracts.",
    };
  }
  return { ok: true };
}

/**
 * After PM approve:
 * - no deposit required → active
 * - deposit required → deposit_pending until deposit cash meets required deposit amount
 */
export function statusAfterApproval(c: {
  deposit_required: boolean;
}): ContractStatus {
  return c.deposit_required ? "deposit_pending" : "active";
}

export function statusAfterDepositSatisfied(): ContractStatus {
  return "active";
}

export function isOpenEngagement(status: string): boolean {
  return OPEN_WORK_STATUSES.includes(status as ContractStatus);
}

/** Methods that must have payment schedule amounts reconciling to commercial value. */
export function requiresPaymentScheduleReconcile(
  billingMethod: string | null | undefined,
): boolean {
  const m = billingMethod || "fixed_price";
  return (
    m === "fixed_price" ||
    m === "milestone" ||
    m === "progress" ||
    m === "deposit" ||
    m === "retainer"
  );
}

export function paymentScheduleReconcile(
  billingMethod: string | null | undefined,
  milestoneAmounts: number[],
  contractValue: number,
  tolerance = 0.01,
): { ok: boolean; sum: number; severity: "error" | "warning" | "ok" } {
  const sum = milestoneAmounts.reduce((a, b) => a + Number(b || 0), 0);
  const delta = Math.abs(sum - Number(contractValue || 0));
  if (!requiresPaymentScheduleReconcile(billingMethod)) {
    return {
      ok: true,
      sum,
      severity: delta > tolerance ? "warning" : "ok",
    };
  }
  return {
    ok: delta <= tolerance,
    sum,
    severity: delta <= tolerance ? "ok" : "error",
  };
}

/**
 * Change-order ownership:
 * - Contracts module: draft CO, commercial approve, line items, documents.
 * - Compliance module: accounting_treatment, apply to books (status → applied).
 * Both write contract_modifications; Contracts should not invent a second CO table.
 */
export const CHANGE_ORDER_OWNERSHIP = {
  commercialWorkflow: "contracts",
  accountingApply: "compliance",
  sharedTable: "contract_modifications",
} as const;

export const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  deposit_pending: "Deposit pending",
  active: "Active",
  completed: "Completed",
  canceled: "Canceled",
  closed: "Closed",
};

export function statusTone(
  status: string,
): "neutral" | "ok" | "warn" | "danger" | "accent" {
  switch (status as ContractStatus) {
    case "active":
    case "closed":
      return "ok";
    case "approved":
    case "completed":
      return "accent";
    case "pending_approval":
    case "deposit_pending":
    case "draft":
      return "warn";
    case "canceled":
      return "danger";
    default:
      return "neutral";
  }
}

export function depositTone(
  s: string,
): "neutral" | "ok" | "warn" | "danger" | "accent" {
  if (s === "satisfied" || s === "not_required") return "ok";
  if (s === "partial") return "warn";
  if (s === "pending") return "danger";
  return "neutral";
}
