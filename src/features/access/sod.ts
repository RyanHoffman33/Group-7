import type { AccessDecision } from "./types";

/**
 * Segregation-of-duties rules (AIS controls).
 * Call these before approve / pay / issue / recognize actions.
 */
export function denySelfApproval(
  actorUserId: string,
  submittedByUserId: string,
  label = "this item",
): AccessDecision {
  if (actorUserId === submittedByUserId) {
    return {
      allowed: false,
      code: "self_approval",
      reason: `You cannot approve ${label} because you submitted it.`,
    };
  }
  return { allowed: true };
}

export function denyVendorSelfPay(
  actorRole: string,
  invoiceOwnerVendorUserId: string,
  actorUserId: string,
): AccessDecision {
  if (actorRole === "vendor" && actorUserId === invoiceOwnerVendorUserId) {
    return {
      allowed: false,
      code: "sod_violation",
      reason: "Vendors cannot approve or mark their own invoices as paid.",
    };
  }
  return { allowed: true };
}

export function denyPmIndependentInvoiceCollection(actorRole: string): AccessDecision {
  if (actorRole === "project_manager") {
    return {
      allowed: false,
      code: "sod_violation",
      reason:
        "Project Managers may mark work ready for billing, but Accounting issues invoices and records payments.",
    };
  }
  return { allowed: true };
}

export function denyCoordinatorFinancialAccess(actorRole: string): AccessDecision {
  if (actorRole === "event_coordinator") {
    return {
      allowed: false,
      code: "sod_violation",
      reason:
        "Event Coordinators cannot access accounts receivable, profitability, or revenue recognition.",
    };
  }
  return { allowed: true };
}

export function denyAdminAccountingByDefault(actorRole: string): AccessDecision {
  if (actorRole === "system_admin") {
    return {
      allowed: false,
      code: "sod_violation",
      reason:
        "System Administrators manage users and roles — not invoices, payments, or recognition by default.",
    };
  }
  return { allowed: true };
}

export function denyCustomerInternalEdit(actorRole: string): AccessDecision {
  if (actorRole === "customer") {
    return {
      allowed: false,
      code: "sod_violation",
      reason: "Customers cannot change internal contract or accounting records.",
    };
  }
  return { allowed: true };
}

export function denyDirectEditOfApprovedContract(locked: boolean): AccessDecision {
  if (locked) {
    return {
      allowed: false,
      code: "record_locked",
      reason:
        "Approved contracts cannot be edited directly. Submit a controlled change order.",
    };
  }
  return { allowed: true };
}

export function denyOverwriteIssuedInvoice(status: string): AccessDecision {
  const locked = ["unpaid", "paid", "partial", "issued", "overdue"].includes(
    status.toLowerCase(),
  );
  if (locked) {
    return {
      allowed: false,
      code: "record_locked",
      reason:
        "Issued invoices cannot be overwritten. Use void, credit, or an approved adjustment.",
    };
  }
  return { allowed: true };
}

export function denyCasualPaymentDelete(hasReversalReason: boolean): AccessDecision {
  if (!hasReversalReason) {
    return {
      allowed: false,
      code: "record_locked",
      reason:
        "Recorded payments cannot be deleted casually. Post a reversal with a documented reason.",
    };
  }
  return { allowed: true };
}

export function denyCreatorApprovesAndPaysVendorBill(
  creatorUserId: string,
  actorUserId: string,
  alsoPaying: boolean,
): AccessDecision {
  if (alsoPaying && creatorUserId === actorUserId) {
    return {
      allowed: false,
      code: "sod_violation",
      reason:
        "The person who created a vendor invoice cannot independently approve and pay it.",
    };
  }
  return { allowed: true };
}
