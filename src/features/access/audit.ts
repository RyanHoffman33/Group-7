import type { AccessAuditEvent } from "./types";

/** In-memory append-only audit trail for the demo (not editable via UI). */
export const accessAuditEvents: AccessAuditEvent[] = [
  {
    id: "aa-seed-1",
    at: "2026-08-01T10:00:00.000Z",
    actorUserId: "usr-admin",
    actorName: "Alex Admin",
    actorRole: "system_admin",
    action: "role_assigned",
    recordType: "user",
    recordId: "usr-emp",
    newValue: "event_coordinator",
    detail: "Assigned Event Coordinator role",
  },
];

export async function appendAccessAudit(input: {
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  recordType: string;
  recordId: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  approvalStatus?: string;
  detail: string;
}): Promise<AccessAuditEvent> {
  const entry: AccessAuditEvent = {
    id: `aa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...input,
  };
  accessAuditEvents.unshift(entry);
  return entry;
}

export async function listAccessAuditEvents(): Promise<AccessAuditEvent[]> {
  return [...accessAuditEvents];
}
