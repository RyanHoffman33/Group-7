import type { AppRole } from "./types";
import { roleHasAnyPermission, roleHasPermission } from "@/features/access/matrix";

/** Nav sections visible for a role (derived from permission matrix). */
export type NavSection =
  | "users"
  | "billing"
  | "compliance"
  | "events"
  | "attendee"
  | "vendor"
  | "approvals"
  | "home_only";

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
  if (
    roleHasPermission(roleKey, "billing.read") ||
    roleHasPermission(roleKey, "ar.read")
  ) {
    // Coordinators must never see billing nav even if a key drifts
    if (roleKey !== "event_coordinator" && roleKey !== "vendor" && roleKey !== "attendee" && roleKey !== "customer") {
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
  if (roleHasPermission(roleKey, "attendee.portal") && roleKey === "attendee") {
    sections.push("attendee");
  }
  if (roleHasPermission(roleKey, "vendor.portal") && (roleKey === "vendor" || roleKey === "project_manager" || roleKey === "system_admin")) {
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
  if (
    (roleHasPermission(roleKey, "billing.read") || roleHasPermission(roleKey, "ar.read")) &&
    roleKey !== "event_coordinator" &&
    roleKey !== "vendor" &&
    roleKey !== "attendee" &&
    roleKey !== "customer"
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

  // API: only roles with financial or ops need — still checked in route handlers
  if (
    roleHasAnyPermission(roleKey, [
      "billing.read",
      "ar.read",
      "compliance.read",
      "dashboards.executive",
      "events.operate",
    ])
  ) {
    prefixes.push("/api");
  }

  return prefixes;
}
