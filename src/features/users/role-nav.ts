import type { AppRole } from "./types";
import { roleHasAnyPermission, roleHasPermission } from "@/features/access/matrix";

/** Nav sections visible for a role (derived from permission matrix). */
export type NavSection =
  | "users"
  | "billing"
  | "compliance"
  | "contracts"
  | "work"
  | "costs"
  | "profitability"
  | "analytics"
  | "events"
  | "attendee"
  | "vendor"
  | "customer"
  | "approvals"
  | "home_only";

/** Roles that must not open internal finance suites (except their own portal). */
const INTERNAL_FINANCE_BLOCKED: AppRole[] = [
  "event_coordinator",
  "vendor",
  "attendee",
  "customer",
];

export function navSectionsForRole(roleKey: AppRole): NavSection[] {
  const sections: NavSection[] = [];

  if (roleKey === "customer") {
    sections.push("customer");
    return sections;
  }

  if (roleHasPermission(roleKey, "users.read") || roleHasPermission(roleKey, "users.manage")) {
    sections.push("users");
  }
  if (
    roleHasPermission(roleKey, "events.operate") ||
    roleHasPermission(roleKey, "events.assigned_only")
  ) {
    sections.push("events");
  }
  if (
    roleHasPermission(roleKey, "contracts.read") &&
    !INTERNAL_FINANCE_BLOCKED.includes(roleKey)
  ) {
    sections.push("contracts");
  }
  if (
    (roleHasPermission(roleKey, "billing.read") || roleHasPermission(roleKey, "ar.read")) &&
    !INTERNAL_FINANCE_BLOCKED.includes(roleKey) &&
    roleKey !== "event_coordinator"
  ) {
    sections.push("billing");
  }
  if (
    (roleHasPermission(roleKey, "compliance.read") ||
      roleHasPermission(roleKey, "recognition.read")) &&
    roleKey !== "event_coordinator" &&
    roleKey !== "project_manager"
  ) {
    sections.push("compliance");
  }
  if (
    (roleHasPermission(roleKey, "events.operate") ||
      roleHasPermission(roleKey, "ready_for_billing")) &&
    !INTERNAL_FINANCE_BLOCKED.includes(roleKey)
  ) {
    sections.push("work");
  }
  if (
    (roleHasPermission(roleKey, "costs.read") ||
      roleHasPermission(roleKey, "expenses.submit")) &&
    roleKey !== "vendor" &&
    roleKey !== "attendee"
  ) {
    sections.push("costs");
  }
  if (
    roleHasPermission(roleKey, "profitability.read") &&
    !INTERNAL_FINANCE_BLOCKED.includes(roleKey)
  ) {
    // Nested under Analytics Center in the sidebar (not a top-level accordion).
    sections.push("profitability");
  }
  if (roleHasPermission(roleKey, "analytics.read")) {
    sections.push("analytics");
  }
  if (roleHasPermission(roleKey, "attendee.portal") && roleKey === "attendee") {
    sections.push("attendee");
  }
  if (
    roleHasPermission(roleKey, "vendor.portal") &&
    (roleKey === "vendor" || roleKey === "project_manager" || roleKey === "system_admin")
  ) {
    sections.push("vendor");
  }
  if (
    roleHasAnyPermission(roleKey, [
      "approvals.queue",
      "controls.approve",
      "expenses.approve",
      "exceptions.approve_major",
    ])
  ) {
    sections.push("approvals");
  }
  if (sections.length === 0) sections.push("home_only");
  return sections;
}

/**
 * Role-specific "My Dashboard" destination.
 */
export function homePathForRole(roleKey: AppRole): string {
  switch (roleKey) {
    case "attendee":
      return "/attendee";
    case "vendor":
      return "/vendor";
    case "customer":
      return "/dashboard/customer";
    case "accounting":
      return "/dashboard/accounting";
    case "event_coordinator":
      return "/dashboard/employee";
    case "project_manager":
    case "department_manager":
    case "executive":
    case "system_admin":
    default:
      return "/dashboard";
  }
}

/** Whether this role may open the given /dashboard path (own board only). */
export function canAccessDashboardPath(
  roleKey: AppRole,
  pathname: string,
): boolean {
  if (pathname !== "/dashboard" && !pathname.startsWith("/dashboard/")) {
    return false;
  }
  const home = homePathForRole(roleKey);
  if (home === "/attendee" || home === "/vendor") return false;
  if (home === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === home || pathname.startsWith(`${home}/`);
}

/** Safe in-app destinations for shared manager-board deep links. */
export function managerBoardLinks(roleKey: AppRole): {
  events: string;
  costs: string;
  changeOrders: string;
  billing: string;
  aging: string;
  alerts: string;
  approvals: string;
} {
  const hasCompliance =
    roleHasPermission(roleKey, "compliance.read") ||
    roleHasPermission(roleKey, "recognition.read");
  const hasWork =
    roleHasPermission(roleKey, "events.operate") ||
    roleHasPermission(roleKey, "ready_for_billing");
  const hasEvents =
    roleHasPermission(roleKey, "events.operate") ||
    roleHasPermission(roleKey, "events.assigned_only");

  return {
    events: hasCompliance
      ? "/compliance"
      : hasWork
        ? "/work"
        : hasEvents
          ? "/events"
          : "/contracts",
    costs: hasCompliance ? "/compliance/costs" : "/costs",
    changeOrders: hasCompliance
      ? "/compliance/modifications"
      : "/contracts/change-orders",
    billing: "/billing",
    aging: "/billing/aging",
    alerts: "/billing/alerts",
    approvals: roleHasAnyPermission(roleKey, [
      "approvals.queue",
      "controls.approve",
      "expenses.approve",
    ])
      ? "/approvals"
      : "/contracts",
  };
}

/** Routes allowed per role (middleware). Prefix match. */
export function allowedRoutePrefixes(roleKey: AppRole): string[] {
  const common = ["/home", "/login", "/access-denied"];
  const prefixes = [...common];

  if (roleKey === "customer") {
    prefixes.push("/dashboard/customer");
    return prefixes;
  }

  if (roleHasPermission(roleKey, "users.read") || roleHasPermission(roleKey, "users.manage")) {
    prefixes.push("/users");
  }
  if (
    roleHasPermission(roleKey, "events.operate") ||
    roleHasPermission(roleKey, "events.assigned_only")
  ) {
    prefixes.push("/events");
  }
  if (
    roleHasPermission(roleKey, "contracts.read") &&
    !INTERNAL_FINANCE_BLOCKED.includes(roleKey)
  ) {
    prefixes.push("/contracts");
  }
  if (
    (roleHasPermission(roleKey, "billing.read") || roleHasPermission(roleKey, "ar.read")) &&
    !INTERNAL_FINANCE_BLOCKED.includes(roleKey)
  ) {
    prefixes.push("/billing");
  }
  if (
    (roleHasPermission(roleKey, "compliance.read") ||
      roleHasPermission(roleKey, "recognition.read")) &&
    roleKey !== "event_coordinator" &&
    roleKey !== "project_manager"
  ) {
    prefixes.push("/compliance");
  }
  if (
    (roleHasPermission(roleKey, "events.operate") ||
      roleHasPermission(roleKey, "ready_for_billing")) &&
    !INTERNAL_FINANCE_BLOCKED.includes(roleKey)
  ) {
    prefixes.push("/work");
  }
  if (
    roleHasPermission(roleKey, "costs.read") ||
    roleHasPermission(roleKey, "expenses.submit")
  ) {
    if (roleKey !== "vendor" && roleKey !== "attendee") {
      prefixes.push("/costs");
    }
  }
  if (
    roleHasPermission(roleKey, "profitability.read") &&
    !INTERNAL_FINANCE_BLOCKED.includes(roleKey)
  ) {
    prefixes.push("/profitability");
  }
  if (roleHasPermission(roleKey, "analytics.read")) {
    prefixes.push("/analytics");
  }

  const dashboardHome = homePathForRole(roleKey);
  if (dashboardHome.startsWith("/dashboard")) {
    prefixes.push(dashboardHome);
  }

  if (roleKey === "attendee") {
    prefixes.push("/attendee");
  }
  if (
    roleHasPermission(roleKey, "vendor.portal") &&
    (roleKey === "vendor" || roleKey === "project_manager" || roleKey === "system_admin")
  ) {
    prefixes.push("/vendor");
  }
  if (
    roleHasAnyPermission(roleKey, [
      "approvals.queue",
      "controls.approve",
      "expenses.approve",
      "exceptions.approve_major",
      "contracts.approve_co",
    ])
  ) {
    prefixes.push("/approvals");
  }

  if (
    roleHasAnyPermission(roleKey, [
      "billing.read",
      "ar.read",
      "compliance.read",
      "dashboards.executive",
      "events.operate",
      "costs.read",
      "expenses.submit",
      "profitability.read",
      "analytics.read",
      "contracts.read",
      "users.read",
    ])
  ) {
    prefixes.push("/api");
  }

  return prefixes;
}
