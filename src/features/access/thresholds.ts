import type { ApprovalKind, ApprovalThreshold } from "./types";

/** Configurable demo thresholds — not hard-coded production policy. */
export const APPROVAL_THRESHOLDS: ApprovalThreshold[] = [
  {
    id: "thr-exp-pm",
    kind: "expense",
    label: "Employee expense up to $250",
    maxAmount: 250,
    maxPercent: null,
    approverRole: "project_manager",
    note: "Demo threshold — Project Manager approval",
  },
  {
    id: "thr-exp-dm",
    kind: "expense",
    label: "Employee expense above $250",
    maxAmount: null,
    maxPercent: null,
    approverRole: "department_manager",
    note: "Demo threshold — Department Manager approval",
  },
  {
    id: "thr-budget-dm",
    kind: "budget_change",
    label: "Budget change below 5%",
    maxAmount: null,
    maxPercent: 5,
    approverRole: "department_manager",
    note: "PM submits; Department Manager approves",
  },
  {
    id: "thr-budget-exec",
    kind: "budget_change",
    label: "Budget change above 5%",
    maxAmount: null,
    maxPercent: null,
    approverRole: "executive",
    note: "Executive approval required",
  },
  {
    id: "thr-disc-dm",
    kind: "discount",
    label: "Discount up to 5%",
    maxAmount: null,
    maxPercent: 5,
    approverRole: "department_manager",
    note: "Accounting submits; Department Manager approves",
  },
  {
    id: "thr-disc-exec",
    kind: "discount",
    label: "Discount above 5%",
    maxAmount: null,
    maxPercent: null,
    approverRole: "executive",
    note: "Executive approval required",
  },
  {
    id: "thr-wo-dm",
    kind: "write_off",
    label: "Write-off / refund up to $1,000",
    maxAmount: 1000,
    maxPercent: null,
    approverRole: "department_manager",
    note: "Accounting submits; Department Manager approves",
  },
  {
    id: "thr-wo-exec",
    kind: "write_off",
    label: "Write-off / refund above $1,000",
    maxAmount: null,
    maxPercent: null,
    approverRole: "executive",
    note: "Executive approval required",
  },
  {
    id: "thr-refund-dm",
    kind: "refund",
    label: "Refund up to $1,000",
    maxAmount: 1000,
    maxPercent: null,
    approverRole: "department_manager",
    note: "Accounting submits; Department Manager approves",
  },
  {
    id: "thr-refund-exec",
    kind: "refund",
    label: "Refund above $1,000",
    maxAmount: null,
    maxPercent: null,
    approverRole: "executive",
    note: "Executive approval required",
  },
  {
    id: "thr-co",
    kind: "change_order",
    label: "Contract change order",
    maxAmount: null,
    maxPercent: null,
    approverRole: "customer",
    note: "PM submits; Customer + authorized manager approve",
  },
  {
    id: "thr-vendor-inv",
    kind: "vendor_invoice",
    label: "Vendor invoice payment approval",
    maxAmount: null,
    maxPercent: null,
    approverRole: "department_manager",
    note: "Creator cannot independently approve and pay",
  },
];

export function resolveApproverRole(
  kind: ApprovalKind,
  amount: number,
  percent?: number,
): ApprovalThreshold {
  const bands = APPROVAL_THRESHOLDS.filter((t) => t.kind === kind);
  if (kind === "expense") {
    return amount <= 250
      ? bands.find((b) => b.id === "thr-exp-pm")!
      : bands.find((b) => b.id === "thr-exp-dm")!;
  }
  if (kind === "budget_change" || kind === "discount") {
    const pct = percent ?? 0;
    const capped = bands.find((b) => b.maxPercent != null && pct <= b.maxPercent);
    return capped ?? bands.find((b) => b.maxPercent == null)!;
  }
  if (kind === "write_off" || kind === "refund") {
    return amount <= 1000
      ? bands.find((b) => b.maxAmount === 1000)!
      : bands.find((b) => b.maxAmount == null)!;
  }
  return bands[0]!;
}
