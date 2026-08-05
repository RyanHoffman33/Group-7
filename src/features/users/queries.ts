import {
  getRoleByKey,
  listAccessAudit,
  listAssignments,
  listPermissions,
  listRoles,
  listUsers,
  userHasPermission,
} from "./adapters/directory";
import { eventHealth } from "./seed";
import type { AppUser, EventHealthItem, RoleDefinition } from "./types";

export {
  listUsers,
  listRoles,
  listPermissions,
  listAssignments,
  listAccessAudit,
  getRoleByKey,
  userHasPermission,
};

export async function getDirectoryStats() {
  const [users, roles, permissions, audit] = await Promise.all([
    listUsers(),
    listRoles(),
    listPermissions(),
    listAccessAudit(),
  ]);

  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === "active").length,
    invitedUsers: users.filter((u) => u.status === "invited").length,
    disabledUsers: users.filter((u) => u.status === "disabled").length,
    roleCount: roles.length,
    permissionCount: permissions.length,
    recentAudit: audit.slice(0, 5),
  };
}

export async function listUsersWithRoles(): Promise<
  Array<AppUser & { roleName: string }>
> {
  const [users, roles] = await Promise.all([listUsers(), listRoles()]);
  const byKey = new Map(roles.map((r) => [r.key, r]));
  return users.map((u) => ({
    ...u,
    roleName: byKey.get(u.roleKey)?.name ?? u.roleKey,
  }));
}

export async function getPermissionMatrix(): Promise<
  Array<RoleDefinition & { permissionLabels: string[] }>
> {
  const [roles, permissions] = await Promise.all([
    listRoles(),
    listPermissions(),
  ]);
  const labelByKey = new Map(permissions.map((p) => [p.key, p.label]));
  return roles.map((r) => ({
    ...r,
    permissionLabels: r.permissionKeys.map((k) => labelByKey.get(k) ?? k),
  }));
}

export async function listEventHealth(): Promise<EventHealthItem[]> {
  return [...eventHealth];
}

export async function getEventHealthById(
  id: string,
): Promise<EventHealthItem | undefined> {
  return eventHealth.find((e) => e.id === id);
}
