import { getSessionUser } from "@/features/users/session";
import type { AppRole, SessionUser } from "@/features/users/types";
import {
  canAccessDataClass,
  permissionsForResourceAction,
  roleHasAnyPermission,
  roleHasPermission,
} from "./matrix";
import { denyCoordinatorFinancialAccess, denySelfApproval } from "./sod";
import type {
  AccessAction,
  AccessDecision,
  AccessResource,
  DataClass,
  PermissionKey,
} from "./types";
import { appendAccessAudit } from "./audit";

export class AccessDeniedError extends Error {
  code: AccessDecision["code"];
  constructor(decision: AccessDecision) {
    super(decision.reason ?? "Access denied.");
    this.name = "AccessDeniedError";
    this.code = decision.code;
  }
}

export function decidePermission(
  role: AppRole,
  permission: PermissionKey,
): AccessDecision {
  if (!roleHasPermission(role, permission)) {
    return {
      allowed: false,
      code: "missing_permission",
      reason: `Your role (${role}) does not include permission “${permission}”.`,
    };
  }
  return { allowed: true };
}

export function decideResourceAction(
  role: AppRole,
  resource: AccessResource,
  action: AccessAction,
): AccessDecision {
  const keys = permissionsForResourceAction(resource, action);
  if (!keys.length) {
    return {
      allowed: false,
      code: "missing_permission",
      reason: `No permission mapping for ${resource}.${action}.`,
    };
  }
  if (!roleHasAnyPermission(role, keys)) {
    return {
      allowed: false,
      code: "missing_permission",
      reason: `You cannot ${action} ${resource.replace(/_/g, " ")} with your current role.`,
    };
  }
  return { allowed: true };
}

export function decideDataClass(role: AppRole, dataClass: DataClass): AccessDecision {
  if (!canAccessDataClass(role, dataClass)) {
    return {
      allowed: false,
      code: "data_class",
      reason: `Need-to-know denial: “${dataClass.replace(/_/g, " ")}” data is not available to your role.`,
    };
  }
  return { allowed: true };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    throw new AccessDeniedError({
      allowed: false,
      code: "unauthenticated",
      reason: "Sign in required.",
    });
  }
  return session;
}

export async function requirePermission(
  permission: PermissionKey,
): Promise<SessionUser> {
  const session = await requireSession();
  const decision = decidePermission(session.roleKey, permission);
  if (!decision.allowed) {
    await appendAccessAudit({
      actorUserId: session.id,
      actorName: session.fullName,
      actorRole: session.roleKey,
      action: "access_denied",
      recordType: "permission",
      recordId: permission,
      detail: decision.reason ?? "denied",
    });
    throw new AccessDeniedError(decision);
  }
  return session;
}

export async function requireAnyPermission(
  permissions: PermissionKey[],
): Promise<SessionUser> {
  const session = await requireSession();
  if (!roleHasAnyPermission(session.roleKey, permissions)) {
    const decision: AccessDecision = {
      allowed: false,
      code: "missing_permission",
      reason: `Missing required permission (need one of: ${permissions.join(", ")}).`,
    };
    await appendAccessAudit({
      actorUserId: session.id,
      actorName: session.fullName,
      actorRole: session.roleKey,
      action: "access_denied",
      recordType: "permission",
      recordId: permissions.join("|"),
      detail: decision.reason ?? "denied",
    });
    throw new AccessDeniedError(decision);
  }
  return session;
}

export async function requireResourceAction(
  resource: AccessResource,
  action: AccessAction,
): Promise<SessionUser> {
  const session = await requireSession();
  const decision = decideResourceAction(session.roleKey, resource, action);
  if (!decision.allowed) {
    await appendAccessAudit({
      actorUserId: session.id,
      actorName: session.fullName,
      actorRole: session.roleKey,
      action: "access_denied",
      recordType: resource,
      recordId: action,
      detail: decision.reason ?? "denied",
    });
    throw new AccessDeniedError(decision);
  }
  return session;
}

export async function requireNotCoordinatorFinancial(): Promise<SessionUser> {
  const session = await requireSession();
  const decision = denyCoordinatorFinancialAccess(session.roleKey);
  if (!decision.allowed) throw new AccessDeniedError(decision);
  return session;
}

export function assertSelfApprovalAllowed(
  actorUserId: string,
  submittedByUserId: string,
  label?: string,
): void {
  const decision = denySelfApproval(actorUserId, submittedByUserId, label);
  if (!decision.allowed) throw new AccessDeniedError(decision);
}

export function toActionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AccessDeniedError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error." };
}
