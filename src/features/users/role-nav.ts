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
  | "dashboard"
  | "events"
  | "attendee"
  | "vendor"
  | "approvals"
  | "home_only";

const FINANCE_BLOCKED: AppRole[] = [
  "event_coordinator",
  "vendor",
  "attendee",
  "customer",
];

export function navSectionsForRole(roleKey: AppRole): NavSection[] {
  const sections: NavSection[] = [];
  if (roleHasPermission(roleKey, "users.read") || roleHasPermission(roleKey, "users.manage")) {
    sections.push("users");
  }
  if (
    roleHasPermission(roleKey, "events.operate") ||
    roleHasPermission(roleKey, "events.assigned_only")
  ) {
    sections.push("events");
  }
  if (roleHasPermission(roleKey, "contracts.read") && !FINANCE_BLOCKED.includes(roleKey)) {
    sections.push("contracts");
  }
  if (
    roleHasPermission(roleKey, "billing.read") ||
    roleHasPermission(roleKey, "ar.read")
  ) {
    if (!FINANCE_BLOCKED.includes(roleKey) && roleKey !== "event_coordinator") {
      sections.push("billing");
    }
  }
  if (
    roleHasPermission(roleKey, "compliance.read") ||
    roleHasPermission(roleKey, "recognition.read")
  ) {
    if (roleKey !== "event_coordinator" && roleKey !== "project_manager") {
      sections.push("compliance");
    }
  }
  if (
    (roleHasPermission(roleKey, "events.operate") ||
      roleHasPermission(roleKey, "ready_for_billing")) &&
    !FINANCE_BLOCKED.includes(roleKey)
  ) {
    sections.push("work");
  }
  if (roleHasPermission(roleKey, "costs.read") && !FINANCE_BLOCKED.includes(roleKey)) {
    sections.push("costs");
  }
  if (
    roleHasPermission(roleKey, "profitability.read") &&
    !FINANCE_BLOCKED.includes(roleKey)
  ) {
    sections.push("profitability");
  }
  if (
    (roleHasPermission(roleKey, "dashboards.executive") ||
      roleHasPermission(roleKey, "billing.read") ||
      roleHasPermission(roleKey, "ar.read")) &&
    !FINANCE_BLOCKED.includes(roleKey)
  ) {
    sections.push("dashboard");
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

export function homePathForRole(roleKey: AppRole): string {
  if (roleKey === "attendee") return "/attendee";
  if (roleKey === "vendor") return "/vendor";
  return "/home";
}

/** Routes allowed per role (middleware). Prefix match. Derived from permissions. */
export function allowedRoutePrefixes(roleKey: AppRole): string[] {
  const common = ["/home", "/login", "/access-denied"];
  const prefixes = [...common];

  if (roleHasPermission(roleKey, "users.read") || roleHasPermission(roleKey, "users.manage")) {
    prefixes.push("/users");
  }
  if (
    roleHasPermission(roleKey, "events.operate") ||
    roleHasPermission(roleKey, "events.assigned_only")
  ) {
    prefixes.push("/events");
  }
  if (roleHasPermission(roleKey, "contracts.read") && !FINANCE_BLOCKED.includes(roleKey)) {
    prefixes.push("/contracts");
  }
  if (
    (roleHasPermission(roleKey, "billing.read") || roleHasPermission(roleKey, "ar.read")) &&
    !FINANCE_BLOCKED.includes(roleKey)
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
    !FINANCE_BLOCKED.includes(roleKey)
  ) {
    prefixes.push("/work");
  }
  if (roleHasPermission(roleKey, "costs.read") && !FINANCE_BLOCKED.includes(roleKey)) {
    prefixes.push("/costs");
  }
  if (
    roleHasPermission(roleKey, "profitability.read") &&
    !FINANCE_BLOCKED.includes(roleKey)
  ) {
    prefixes.push("/profitability");
  }
  if (
    (roleHasPermission(roleKey, "dashboards.executive") ||
      roleHasPermission(roleKey, "billing.read")) &&
    !FINANCE_BLOCKED.includes(roleKey)
  ) {
    prefixes.push("/dashboard");
  }
  if (roleKey === "attendee" || roleHasPermission(roleKey, "attendee.portal")) {
    if (roleKey === "attendee" || roleKey === "system_admin") prefixes.push("/attendee");
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
      "profitability.read",
      "contracts.read",
    ])
  ) {
    prefixes.push("/api");
  }

  return prefixes;
}
