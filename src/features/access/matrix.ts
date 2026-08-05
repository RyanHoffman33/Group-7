import type { AppRole } from "@/features/users/types";
import type {
  AccessAction,
  AccessResource,
  DataClass,
  PermissionKey,
} from "./types";

/** Maps resource × action → required permission key(s). */
export const RESOURCE_ACTION_PERMISSIONS: Partial<
  Record<AccessResource, Partial<Record<AccessAction, PermissionKey[]>>>
> = {
  users: {
    view: ["users.read"],
    administer: ["users.manage"],
  },
  roles: {
    view: ["users.read"],
    administer: ["roles.manage"],
  },
  audit: {
    view: ["audit.read"],
  },
  billing_module: {
    view: ["billing.read"],
    create: ["billing.write"],
    edit: ["billing.write"],
    export: ["billing.export"],
  },
  compliance_module: {
    view: ["compliance.read"],
    post: ["compliance.recognize"],
    edit: ["compliance.modify"],
  },
  accounts_receivable: {
    view: ["ar.read"],
    export: ["billing.export"],
  },
  customer_invoices: {
    view: ["billing.read"],
    create: ["billing.write"],
    post: ["billing.write"],
    void: ["billing.void"],
  },
  payments: {
    view: ["billing.read"],
    record: ["billing.payment"],
    void: ["billing.void"],
  },
  deposits: {
    view: ["billing.read"],
    record: ["billing.write"],
  },
  revenue_recognition: {
    view: ["recognition.read"],
    post: ["compliance.recognize"],
  },
  profitability: {
    view: ["profitability.read"],
    export: ["reports.export"],
  },
  analytics: {
    view: ["analytics.read"],
    export: ["reports.export", "analytics.read"],
  },
  contracts: {
    view: ["contracts.read"],
    create: ["contracts.write"],
    edit: ["contracts.write"],
    approve: ["contracts.approve_co"],
  },
  change_orders: {
    view: ["contracts.read"],
    create: ["contracts.write"],
    submit: ["contracts.write"],
    approve: ["contracts.approve_co"],
  },
  costs: {
    view: ["costs.read"],
    create: ["costs.write"],
    edit: ["costs.classify"],
  },
  expenses: {
    create: ["expenses.submit"],
    submit: ["expenses.submit"],
    approve: ["expenses.approve"],
    view: ["expenses.submit", "expenses.approve", "costs.read"],
  },
  events: {
    view: ["events.operate", "events.assigned_only", "attendee.portal", "vendor.portal", "customer.portal"],
    edit: ["events.operate"],
  },
  tasks: {
    view: ["events.operate", "events.assigned_only"],
    edit: ["events.operate", "events.assigned_only"],
  },
  qr: {
    view: ["qr.checkin", "qr.manage", "attendee.portal"],
    create: ["qr.manage"],
    edit: ["qr.manage"],
    record: ["qr.checkin"],
  },
  emails: {
    view: ["emails.draft", "emails.manage"],
    create: ["emails.draft", "emails.manage"],
    submit: ["emails.draft"],
    approve: ["emails.manage"],
  },
  speakers: {
    view: ["speakers.support", "speakers.manage"],
    edit: ["speakers.support", "speakers.manage"],
  },
  layouts: {
    view: ["vendor.portal", "events.operate"],
    create: ["vendor.portal"],
    edit: ["vendor.portal"],
    approve: ["events.operate"],
  },
  vendors: {
    view: ["events.operate", "vendor.portal"],
  },
  vendor_invoices: {
    view: ["vendor.portal", "billing.read", "costs.read"],
    create: ["vendor.portal"],
    submit: ["vendor.portal"],
    approve: ["controls.approve"],
  },
  customers: {
    view: ["contracts.read", "customer.portal", "billing.read"],
  },
  discounts: {
    create: ["billing.write"],
    submit: ["billing.write"],
    approve: ["controls.approve", "exceptions.approve_major"],
  },
  refunds: {
    create: ["billing.write"],
    submit: ["billing.write"],
    approve: ["controls.approve", "exceptions.approve_major"],
  },
  write_offs: {
    create: ["billing.write"],
    submit: ["billing.write"],
    approve: ["controls.approve", "exceptions.approve_major"],
  },
  approvals: {
    view: ["approvals.queue", "controls.approve"],
    approve: ["controls.approve", "exceptions.approve_major", "expenses.approve"],
    reject: ["controls.approve", "exceptions.approve_major", "expenses.approve"],
  },
  reports: {
    view: ["dashboards.executive", "billing.read", "reports.export"],
    export: ["reports.export", "billing.export", "dashboards.executive"],
  },
  labor: {
    view: ["events.assigned_only", "events.operate", "costs.read"],
    create: ["expenses.submit", "events.assigned_only"],
  },
};

export const DATA_CLASS_BY_RESOURCE: Record<AccessResource, DataClass> = {
  users: "system_restricted",
  roles: "system_restricted",
  audit: "system_restricted",
  events: "operational",
  tasks: "operational",
  labor: "operational",
  expenses: "operational",
  speakers: "operational",
  qr: "operational",
  emails: "operational",
  layouts: "operational",
  vendors: "operational",
  vendor_invoices: "financial_confidential",
  customers: "customer_facing",
  contracts: "financial_confidential",
  change_orders: "financial_confidential",
  customer_invoices: "financial_confidential",
  payments: "financial_confidential",
  deposits: "financial_confidential",
  accounts_receivable: "financial_confidential",
  revenue_recognition: "financial_confidential",
  profitability: "financial_confidential",
  analytics: "financial_confidential",
  costs: "financial_confidential",
  discounts: "financial_confidential",
  refunds: "financial_confidential",
  write_offs: "financial_confidential",
  approvals: "system_restricted",
  reports: "financial_confidential",
  billing_module: "financial_confidential",
  compliance_module: "financial_confidential",
};

/** Roles allowed to see each data class (need-to-know). */
export const DATA_CLASS_ROLES: Record<DataClass, AppRole[]> = {
  public: [
    "executive",
    "project_manager",
    "event_coordinator",
    "accounting",
    "vendor",
    "customer",
    "department_manager",
    "system_admin",
    "attendee",
  ],
  customer_facing: [
    "executive",
    "project_manager",
    "accounting",
    "department_manager",
    "customer",
    "system_admin",
  ],
  operational: [
    "executive",
    "project_manager",
    "event_coordinator",
    "accounting",
    "department_manager",
    "vendor",
    "system_admin",
  ],
  financial_confidential: [
    "executive",
    "project_manager",
    "accounting",
    "department_manager",
  ],
  system_restricted: ["system_admin", "executive", "department_manager", "accounting"],
};

/**
 * Canonical role → permission keys.
 * System admin: directory/roles only — NOT accounting transaction authority.
 */
export const ROLE_PERMISSIONS: Record<AppRole, PermissionKey[]> = {
  system_admin: [
    "users.read",
    "users.manage",
    "roles.manage",
    "audit.read",
    "events.operate",
    "attendee.portal",
    "vendor.portal",
    "customer.portal",
    "billing.read",
    "billing.write",
    "billing.void",
    "billing.payment",
    "billing.export",
    "compliance.read",
    "compliance.recognize",
    "compliance.modify",
    "recognition.read",
    "contracts.read",
    "contracts.write",
    "contracts.approve_co",
    "costs.read",
    "costs.write",
    "costs.classify",
    "profitability.read",
    "analytics.read",
    "ar.read",
    "dashboards.executive",
    "reports.export",
    "approvals.queue",
    "controls.approve",
    "expenses.approve",
    "exceptions.approve_major",
    "ready_for_billing",
  ],
  executive: [
    "users.read",
    "audit.read",
    "billing.read",
    "billing.export",
    "compliance.read",
    "recognition.read",
    "contracts.read",
    "costs.read",
    "profitability.read",
    "analytics.read",
    "ar.read",
    "dashboards.executive",
    "reports.export",
    "events.operate",
    "exceptions.approve_major",
    "controls.approve",
    "approvals.queue",
  ],
  project_manager: [
    "users.read",
    "billing.read",
    "contracts.read",
    "contracts.write",
    "costs.read",
    "analytics.read",
    "events.operate",
    "qr.manage",
    "qr.checkin",
    "emails.manage",
    "emails.draft",
    "speakers.manage",
    "speakers.support",
    "expenses.approve",
    "ready_for_billing",
    "vendor.portal",
    "audit.read",
  ],
  event_coordinator: [
    "events.assigned_only",
    "qr.checkin",
    "emails.draft",
    "speakers.support",
    "expenses.submit",
  ],
  accounting: [
    "users.read",
    "billing.read",
    "billing.write",
    "billing.void",
    "billing.payment",
    "billing.export",
    "compliance.read",
    "compliance.recognize",
    "compliance.modify",
    "recognition.read",
    "contracts.read",
    "costs.read",
    "costs.classify",
    "profitability.read",
    "analytics.read",
    "ar.read",
    "audit.read",
    "reports.export",
  ],
  department_manager: [
    "users.read",
    "contracts.read",
    "costs.read",
    "billing.read",
    "ar.read",
    "analytics.read",
    "controls.approve",
    "approvals.queue",
    "expenses.approve",
    "contracts.approve_co",
    "audit.read",
  ],
  vendor: ["vendor.portal"],
  customer: ["customer.portal", "contracts.read"],
  attendee: ["attendee.portal"],
};

export function roleHasPermission(
  role: AppRole,
  permission: PermissionKey,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function roleHasAnyPermission(
  role: AppRole,
  keys: PermissionKey[],
): boolean {
  return keys.some((k) => roleHasPermission(role, k));
}

export function permissionsForResourceAction(
  resource: AccessResource,
  action: AccessAction,
): PermissionKey[] {
  return RESOURCE_ACTION_PERMISSIONS[resource]?.[action] ?? [];
}

export function canAccessDataClass(role: AppRole, dataClass: DataClass): boolean {
  return DATA_CLASS_ROLES[dataClass].includes(role);
}

/** PM may see event-level financial summaries, not company-wide AR posting surfaces. */
export function canViewCompanyWideAr(role: AppRole): boolean {
  return roleHasPermission(role, "ar.read") && role !== "project_manager";
}
