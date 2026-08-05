/** Application roles for MainEvent (demo seed until Supabase Auth + RLS). */
export type { PermissionKey } from "@/features/access/types";
import type { PermissionKey } from "@/features/access/types";

export type AppRole =
  | "executive"
  | "project_manager"
  | "event_coordinator"
  | "accounting"
  | "vendor"
  | "customer"
  | "department_manager"
  | "system_admin"
  | "attendee";

export type UserStatus = "active" | "invited" | "disabled";

export interface Permission {
  key: PermissionKey;
  label: string;
  module: string;
  description: string;
}

export interface RoleDefinition {
  id: string;
  key: AppRole;
  name: string;
  description: string;
  permissionKeys: PermissionKey[];
  homePath: string;
}

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  /** Demo only — never use real passwords in seed data. */
  demoPassword: string;
  roleKey: AppRole;
  status: UserStatus;
  organization: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleAssignment {
  id: string;
  userId: string;
  roleKey: AppRole;
  assignedBy: string;
  assignedAt: string;
  note?: string;
}

export interface AccessAuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

export interface EventHealthItem {
  id: string;
  name: string;
  customer: string;
  eventDate: string;
  score: number;
  status: "healthy" | "attention" | "at_risk";
  checks: { label: string; ok: boolean }[];
  whyNot100: string[];
  progressPct: number;
  stage: string;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roleKey: AppRole;
  roleName: string;
  organization: string;
}
