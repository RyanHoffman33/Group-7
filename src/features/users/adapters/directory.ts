/**
 * Directory adapter — currently local seed only.
 * When Supabase Auth + profiles land, replace implementations here
 * without changing page or query call sites.
 */
import {
  accessAudit,
  assignments,
  permissions,
  roles,
  users,
} from "../seed";
import { roleHasPermission } from "@/features/access/matrix";
import type {
  AccessAuditEntry,
  AppUser,
  Permission,
  PermissionKey,
  RoleAssignment,
  RoleDefinition,
} from "../types";

export async function listUsers(): Promise<AppUser[]> {
  return [...users];
}

export async function listRoles(): Promise<RoleDefinition[]> {
  return [...roles];
}

export async function listPermissions(): Promise<Permission[]> {
  return [...permissions];
}

export async function listAssignments(): Promise<RoleAssignment[]> {
  return [...assignments];
}

export async function listAccessAudit(): Promise<AccessAuditEntry[]> {
  return [...accessAudit];
}

export async function getRoleByKey(
  key: string,
): Promise<RoleDefinition | undefined> {
  return roles.find((r) => r.key === key);
}

export async function userHasPermission(
  userId: string,
  permission: PermissionKey,
): Promise<boolean> {
  const user = users.find((u) => u.id === userId);
  if (!user || user.status !== "active") return false;
  return roleHasPermission(user.roleKey, permission);
}
