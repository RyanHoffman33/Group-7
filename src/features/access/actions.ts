"use server";

import { revalidatePath } from "next/cache";
import { appendAccessAudit } from "./audit";
import {
  AccessDeniedError,
  assertSelfApprovalAllowed,
  requireAnyPermission,
  requirePermission,
  toActionError,
} from "./enforce";
import {
  createApprovalDraft,
  getApproval,
  listApprovals,
  approvalItems,
} from "./approvals-seed";
import { roleHasPermission } from "./matrix";
import type { ApprovalItem, ApprovalKind } from "./types";

export async function listApprovalQueueAction(): Promise<
  { ok: true; items: ApprovalItem[] } | { ok: false; error: string }
> {
  try {
    await requireAnyPermission([
      "approvals.queue",
      "controls.approve",
      "expenses.approve",
      "exceptions.approve_major",
    ]);
    return { ok: true, items: listApprovals() };
  } catch (e) {
    return toActionError(e);
  }
}

export async function submitApprovalItemAction(input: {
  kind: ApprovalKind;
  title: string;
  amount: number;
  percent?: number;
  eventId?: string;
  recordType: string;
  recordId: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await requireAnyPermission([
      "expenses.submit",
      "billing.write",
      "contracts.write",
    ]);
    const item = createApprovalDraft({
      ...input,
      submittedByUserId: session.id,
      submittedByName: session.fullName,
    });
    await appendAccessAudit({
      actorUserId: session.id,
      actorName: session.fullName,
      actorRole: session.roleKey,
      action: "approval_submitted",
      recordType: item.recordType,
      recordId: item.recordId,
      approvalStatus: item.status,
      detail: `${item.kind}: ${item.title}`,
    });
    revalidatePath("/home");
    revalidatePath("/approvals");
    return { ok: true, id: item.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function decideApprovalAction(input: {
  approvalId: string;
  decision: "approved" | "rejected" | "revision_requested";
  comment?: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const session = await requireAnyPermission([
      "controls.approve",
      "expenses.approve",
      "exceptions.approve_major",
      "contracts.approve_co",
    ]);
    const item = getApproval(input.approvalId);
    if (!item) return { ok: false, error: "Approval item not found." };
    if (item.locked || ["approved", "rejected", "voided", "posted"].includes(item.status)) {
      return {
        ok: false,
        error: "This approval record is locked and cannot be changed.",
      };
    }

    assertSelfApprovalAllowed(
      session.id,
      item.submittedByUserId,
      "this expense/request",
    );

    const roleOk =
      session.roleKey === item.approverRoleRequired ||
      (item.approverRoleRequired === "project_manager" &&
        roleHasPermission(session.roleKey, "expenses.approve") &&
        session.roleKey === "project_manager") ||
      (item.approverRoleRequired === "department_manager" &&
        session.roleKey === "department_manager") ||
      (item.approverRoleRequired === "executive" &&
        session.roleKey === "executive") ||
      (item.approverRoleRequired === "customer" &&
        session.roleKey === "customer") ||
      (session.roleKey === "executive" &&
        roleHasPermission(session.roleKey, "exceptions.approve_major"));

    if (!roleOk) {
      throw new AccessDeniedError({
        allowed: false,
        code: "threshold",
        reason: `This item requires ${item.approverRoleRequired.replace(/_/g, " ")} authority.`,
      });
    }

    item.status = input.decision;
    item.approvedByUserId = session.id;
    item.approvedByName = session.fullName;
    item.decidedAt = new Date().toISOString();
    item.comment = input.comment;
    if (input.decision === "approved") item.locked = true;

    await appendAccessAudit({
      actorUserId: session.id,
      actorName: session.fullName,
      actorRole: session.roleKey,
      action: `approval_${input.decision}`,
      recordType: item.recordType,
      recordId: item.recordId,
      approvalStatus: item.status,
      reason: input.comment,
      detail: `${item.title} → ${input.decision}`,
    });

    revalidatePath("/home");
    revalidatePath("/approvals");
    return {
      ok: true,
      message: `Marked ${input.decision.replace("_", " ")}.`,
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function trySelfApproveDemo(
  approvalId: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  /** Explicit test helper used by validation docs — always goes through SoD. */
  try {
    await requirePermission("expenses.submit");
    const item = approvalItems.find((a) => a.id === approvalId);
    if (!item) return { ok: false, error: "Not found." };
    assertSelfApprovalAllowed(
      item.submittedByUserId,
      item.submittedByUserId,
      "this expense",
    );
    return { ok: true, message: "Unexpectedly allowed." };
  } catch (e) {
    return toActionError(e);
  }
}
