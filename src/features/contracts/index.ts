/**
 * Thin re-export surface for teammates (Billing, Work, Compliance).
 * Prefer canBillChargeKind / isDepositSatisfied / canStartWork over status string compares.
 */
export {
  canBillChargeKind,
  canStartWork,
  canEditCommercialTerms,
  canSubmitForApproval,
  assertCanApproveContract,
  statusAfterApproval,
  statusAfterDepositSatisfied,
  isDepositSatisfied,
  requiredDepositAmount,
  paymentScheduleReconcile,
  requiresPaymentScheduleReconcile,
  isOpenEngagement,
  CHANGE_ORDER_OWNERSHIP,
  CONTRACT_STATUSES,
  STATUS_LABELS,
  statusTone,
  depositTone,
  type ContractStatus,
  type BillableChargeKind,
} from "./status";

export type {
  EngagementContract,
  ContractLineItem,
  ContractApproval,
  ContractDocument,
  ContractAuditEvent,
  ContractCommercialPosition,
} from "./types";
