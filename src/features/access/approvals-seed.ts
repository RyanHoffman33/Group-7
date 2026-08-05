import type { ApprovalItem } from "./types";
import { resolveApproverRole } from "./thresholds";

/** Seed approval queue for SoD demos. */
export const approvalItems: ApprovalItem[] = [
  {
    id: "appr-1",
    kind: "expense",
    title: "Coordinator mileage — Harbor Hall",
    amount: 126,
    status: "submitted",
    submittedByUserId: "usr-emp",
    submittedByName: "Chris Employee",
    submittedAt: "2026-08-04T16:00:00.000Z",
    approverRoleRequired: "project_manager",
    eventId: "evt-ops-1",
    recordType: "expense",
    recordId: "exp-1",
    locked: false,
  },
  {
    id: "appr-2",
    kind: "expense",
    title: "Rush badge printing",
    amount: 420,
    status: "submitted",
    submittedByUserId: "usr-emp",
    submittedByName: "Chris Employee",
    submittedAt: "2026-08-05T09:00:00.000Z",
    approverRoleRequired: "department_manager",
    eventId: "evt-ops-1",
    recordType: "expense",
    recordId: "exp-2",
    locked: false,
  },
  {
    id: "appr-3",
    kind: "write_off",
    title: "Goodwill credit — NovaTech",
    amount: 2500,
    status: "submitted",
    submittedByUserId: "usr-acct",
    submittedByName: "Avery Accounting",
    submittedAt: "2026-08-03T14:00:00.000Z",
    approverRoleRequired: "executive",
    recordType: "write_off",
    recordId: "wo-1",
    locked: false,
  },
  {
    id: "appr-4",
    kind: "discount",
    title: "Early-pay discount request 7%",
    amount: 9940,
    percent: 7,
    status: "submitted",
    submittedByUserId: "usr-acct",
    submittedByName: "Avery Accounting",
    submittedAt: "2026-08-02T11:00:00.000Z",
    approverRoleRequired: "executive",
    recordType: "discount",
    recordId: "disc-1",
    locked: false,
  },
  {
    id: "appr-5",
    kind: "change_order",
    title: "Seating chart change — NovaTech",
    amount: 0,
    status: "submitted",
    submittedByUserId: "usr-mgr",
    submittedByName: "Morgan Manager",
    submittedAt: "2026-08-01T15:00:00.000Z",
    approverRoleRequired: "customer",
    eventId: "evt-ops-1",
    recordType: "change_order",
    recordId: "co-1",
    locked: false,
  },
];

export function listApprovals(): ApprovalItem[] {
  return [...approvalItems];
}

export function getApproval(id: string): ApprovalItem | undefined {
  return approvalItems.find((a) => a.id === id);
}

export function createApprovalDraft(input: {
  kind: ApprovalItem["kind"];
  title: string;
  amount: number;
  percent?: number;
  submittedByUserId: string;
  submittedByName: string;
  eventId?: string;
  recordType: string;
  recordId: string;
}): ApprovalItem {
  const thr = resolveApproverRole(input.kind, input.amount, input.percent);
  const item: ApprovalItem = {
    id: `appr-${Date.now()}`,
    kind: input.kind,
    title: input.title,
    amount: input.amount,
    percent: input.percent,
    status: "submitted",
    submittedByUserId: input.submittedByUserId,
    submittedByName: input.submittedByName,
    submittedAt: new Date().toISOString(),
    approverRoleRequired: thr.approverRole,
    eventId: input.eventId,
    recordType: input.recordType,
    recordId: input.recordId,
    locked: false,
  };
  approvalItems.unshift(item);
  return item;
}
