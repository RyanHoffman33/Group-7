/** Central RBAC types for MainEvent AIS access control. */

export type AccessAction =
  | "view"
  | "create"
  | "edit"
  | "submit"
  | "approve"
  | "reject"
  | "record"
  | "post"
  | "void"
  | "export"
  | "administer";

export type DataClass =
  | "public"
  | "customer_facing"
  | "operational"
  | "financial_confidential"
  | "system_restricted";

export type AccessResource =
  | "users"
  | "roles"
  | "audit"
  | "events"
  | "tasks"
  | "labor"
  | "expenses"
  | "speakers"
  | "qr"
  | "emails"
  | "layouts"
  | "vendors"
  | "vendor_invoices"
  | "customers"
  | "contracts"
  | "change_orders"
  | "customer_invoices"
  | "payments"
  | "deposits"
  | "accounts_receivable"
  | "revenue_recognition"
  | "profitability"
  | "analytics"
  | "costs"
  | "discounts"
  | "refunds"
  | "write_offs"
  | "approvals"
  | "reports"
  | "billing_module"
  | "compliance_module";

/** Fine-grained permission keys used by the matrix and seed roles. */
export type PermissionKey =
  | "users.read"
  | "users.manage"
  | "roles.manage"
  | "audit.read"
  | "billing.read"
  | "billing.write"
  | "billing.void"
  | "billing.payment"
  | "billing.export"
  | "compliance.read"
  | "compliance.recognize"
  | "compliance.modify"
  | "contracts.read"
  | "contracts.write"
  | "contracts.approve_co"
  | "costs.read"
  | "costs.write"
  | "costs.classify"
  | "profitability.read"
  | "analytics.read"
  | "ar.read"
  | "recognition.read"
  | "dashboards.executive"
  | "controls.approve"
  | "approvals.queue"
  | "exceptions.approve_major"
  | "attendee.portal"
  | "events.operate"
  | "events.assigned_only"
  | "qr.manage"
  | "qr.checkin"
  | "emails.manage"
  | "emails.draft"
  | "speakers.manage"
  | "speakers.support"
  | "vendor.portal"
  | "customer.portal"
  | "expenses.submit"
  | "expenses.approve"
  | "ready_for_billing"
  | "reports.export";

export type ApprovalKind =
  | "expense"
  | "budget_change"
  | "discount"
  | "write_off"
  | "refund"
  | "change_order"
  | "vendor_invoice";

export type ApprovalStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "posted"
  | "voided"
  | "reversed"
  | "locked";

export interface ApprovalThreshold {
  id: string;
  kind: ApprovalKind;
  label: string;
  /** Inclusive upper bound for this band; null = no upper bound. */
  maxAmount: number | null;
  /** e.g. budget change percent */
  maxPercent: number | null;
  approverRole:
    | "project_manager"
    | "department_manager"
    | "executive"
    | "customer";
  note: string;
}

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  title: string;
  amount: number;
  percent?: number;
  status: ApprovalStatus;
  submittedByUserId: string;
  submittedByName: string;
  submittedAt: string;
  approverRoleRequired: string;
  approvedByUserId?: string;
  approvedByName?: string;
  decidedAt?: string;
  comment?: string;
  eventId?: string;
  recordType: string;
  recordId: string;
  locked: boolean;
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
  code?:
    | "unauthenticated"
    | "missing_permission"
    | "sod_violation"
    | "self_approval"
    | "record_locked"
    | "threshold"
    | "wrong_scope"
    | "data_class";
}

export interface AccessAuditEvent {
  id: string;
  at: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  recordType: string;
  recordId: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  approvalStatus?: string;
  detail: string;
}
