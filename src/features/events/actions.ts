"use server";

import { revalidatePath } from "next/cache";
import {
  attendeeSessions,
  buildQrPayload,
  checkIns,
  emailCampaigns,
  emailTemplates,
  qrCodes,
  registrations,
  roomLayouts,
  roomLayoutVersions,
  speakers,
} from "./seed";
import type {
  EmailCampaignStatus,
  LayoutObjectType,
  RoomLayoutItem,
} from "./types";
import {
  requireAnyPermission,
  requirePermission,
  toActionError,
} from "@/features/access/enforce";
import { appendAccessAudit } from "@/features/access/audit";

export type ActionResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; error: string };

export async function checkInByPayload(
  payload: string,
  checkedInBy: string,
  allowDuplicate = false,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("qr.checkin");
  const parts = payload.trim().split("|");
  if (parts.length !== 3) {
    return { ok: false, error: "Invalid QR payload format." };
  }
  const [eventId, attendeeId, registrationId] = parts;
  const reg = registrations.find((r) => r.id === registrationId);
  if (!reg || reg.eventId !== eventId || reg.attendeeId !== attendeeId) {
    return { ok: false, error: "QR does not match a registration." };
  }
  if (reg.status === "canceled") {
    return { ok: false, error: "Registration is canceled — QR invalid." };
  }
  const qr = qrCodes.find(
    (q) => q.registrationId === registrationId && q.status === "active",
  );
  if (!qr || qr.payload !== payload) {
    return { ok: false, error: "No active QR code for this registration." };
  }
  const existing = checkIns.find((c) => c.registrationId === registrationId);
  if (existing && !allowDuplicate) {
    return {
      ok: false,
      error: `Already checked in at ${existing.checkedInAt} by ${existing.checkedInBy}. Manager override required.`,
    };
  }
  checkIns.push({
    id: `ci-${Date.now()}`,
    registrationId,
    eventId,
    attendeeId,
    checkedInAt: new Date().toISOString(),
    checkedInBy: checkedInBy || session.fullName,
    method: "qr_scan",
    overrideDuplicate: allowDuplicate && !!existing,
  });
  reg.status = "checked_in";
  await appendAccessAudit({
    actorUserId: session.id,
    actorName: session.fullName,
    actorRole: session.roleKey,
    action: "qr_checkin",
    recordType: "registration",
    recordId: registrationId,
    detail: `Checked in ${registrationId}`,
  });
  revalidatePath(`/events/${eventId}/qr`);
  revalidatePath("/home");
  revalidatePath("/attendee");
  return { ok: true, message: `Checked in registration ${registrationId}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function regenerateQr(
  registrationId: string,
  actor: string,
): Promise<ActionResult> {
  try {
    await requirePermission("qr.manage");
  const reg = registrations.find((r) => r.id === registrationId);
  if (!reg) return { ok: false, error: "Registration not found." };
  if (reg.status === "canceled") {
    return { ok: false, error: "Cannot regenerate QR for canceled registration." };
  }
  const current = qrCodes.find(
    (q) => q.registrationId === registrationId && q.status === "active",
  );
  if (current) {
    current.status = "regenerated";
  }
  const payload = buildQrPayload(reg.eventId, reg.attendeeId, reg.id);
  qrCodes.push({
    id: `qr-${Date.now()}`,
    registrationId: reg.id,
    eventId: reg.eventId,
    attendeeId: reg.attendeeId,
    status: "active",
    payload,
    regeneratedFromId: current?.id,
    createdAt: new Date().toISOString(),
    createdBy: actor,
  });
  revalidatePath(`/events/${reg.eventId}/qr`);
  return { ok: true, message: "QR regenerated. Prior code marked regenerated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deactivateQr(registrationId: string): Promise<ActionResult> {
  try {
    await requirePermission("qr.manage");
  const reg = registrations.find((r) => r.id === registrationId);
  const active = qrCodes.find(
    (q) => q.registrationId === registrationId && q.status === "active",
  );
  if (!active) return { ok: false, error: "No active QR to deactivate." };
  active.status = reg?.status === "canceled" ? "canceled" : "inactive";
  if (reg) revalidatePath(`/events/${reg.eventId}/qr`);
  return { ok: true, message: "QR deactivated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function simulateSendEmail(
  campaignId: string,
  actor: string,
): Promise<ActionResult> {
  try {
    await requireAnyPermission(["emails.manage", "emails.draft"]);
  const campaign = emailCampaigns.find((e) => e.id === campaignId);
  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status === "canceled") {
    return { ok: false, error: "Campaign is canceled." };
  }
  if (
    campaign.approvalStatus === "pending" ||
    campaign.approvalStatus === "rejected"
  ) {
    return { ok: false, error: "Campaign is not approved for send." };
  }
  campaign.status = "simulated_sent";
  campaign.sentAt = new Date().toISOString();
  campaign.lastModified = new Date().toISOString().slice(0, 10);
  if (campaign.recipientCount === 0) campaign.recipientCount = 50;
  campaign.openCount = Math.round(campaign.recipientCount * 0.4);
  void actor;
  revalidatePath(`/events/${campaign.eventId}/emails`);
  return {
    ok: true,
    message:
      "Simulated send recorded — message was NOT delivered to real inboxes.",
  };
  } catch (e) {
    return toActionError(e);
  }
}

export async function approveEmailCampaign(
  campaignId: string,
): Promise<ActionResult> {
  try {
    await requirePermission("emails.manage");
  const campaign = emailCampaigns.find((e) => e.id === campaignId);
  if (!campaign) return { ok: false, error: "Campaign not found." };
  campaign.approvalStatus = "approved";
  if (campaign.status === "pending_approval" || campaign.status === "draft") {
    campaign.status = "scheduled";
    campaign.scheduledAt =
      campaign.scheduledAt ?? new Date(Date.now() + 86400000).toISOString();
  }
  revalidatePath(`/events/${campaign.eventId}/emails`);
  return { ok: true, message: "Campaign approved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveEmailDraft(input: {
  id?: string;
  eventId: string;
  name: string;
  audienceType: string;
  emailType: string;
  fromAddress: string;
  toAudience: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  template: string;
  actor: string;
  submitForApproval?: boolean;
  scheduleAt?: string | null;
}): Promise<ActionResult> {
  try {
    await requireAnyPermission(["emails.draft", "emails.manage"]);
  const now = new Date().toISOString().slice(0, 10);
  let status: EmailCampaignStatus = "draft";
  let approvalStatus: "not_required" | "pending" | "approved" | "rejected" =
    "not_required";
  if (input.submitForApproval) {
    status = "pending_approval";
    approvalStatus = "pending";
  } else if (input.scheduleAt) {
    status = "scheduled";
    approvalStatus = "approved";
  }

  if (input.id) {
    const existing = emailCampaigns.find((e) => e.id === input.id);
    if (!existing) return { ok: false, error: "Campaign not found." };
    Object.assign(existing, {
      name: input.name,
      audienceType: input.audienceType,
      emailType: input.emailType,
      fromAddress: input.fromAddress,
      toAudience: input.toAudience,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      template: input.template,
      lastModified: now,
      status: input.submitForApproval
        ? "pending_approval"
        : input.scheduleAt
          ? "scheduled"
          : existing.status === "simulated_sent"
            ? existing.status
            : status === "draft"
              ? "draft"
              : status,
      approvalStatus: input.submitForApproval
        ? "pending"
        : input.scheduleAt
          ? "approved"
          : existing.approvalStatus,
      scheduledAt: input.scheduleAt ?? existing.scheduledAt,
    });
    revalidatePath(`/events/${input.eventId}/emails`);
    return { ok: true, message: "Draft saved.", id: existing.id };
  }

  const id = `em-${Date.now()}`;
  emailCampaigns.push({
    id,
    eventId: input.eventId,
    name: input.name,
    audienceType: input.audienceType,
    emailType: input.emailType,
    status,
    scheduledAt: input.scheduleAt ?? null,
    sentAt: null,
    createdBy: input.actor,
    lastModified: now,
    recipientCount: 0,
    openCount: 0,
    template: input.template,
    approvalStatus,
    fromAddress: input.fromAddress,
    toAudience: input.toAudience,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
  });
  revalidatePath(`/events/${input.eventId}/emails`);
  return {
    ok: true,
    message: input.submitForApproval
      ? "Submitted for approval."
      : "Draft created.",
    id,
  };
  } catch (e) {
    return toActionError(e);
  }
}

export async function getEmailTemplateBody(templateId: string) {
  return emailTemplates.find((t) => t.id === templateId)?.body ?? "";
}

export async function toggleSpeakerRequirement(
  speakerId: string,
  requirementKey: string,
): Promise<ActionResult> {
  try {
    await requireAnyPermission(["speakers.support", "speakers.manage"]);
  const speaker = speakers.find((s) => s.id === speakerId);
  if (!speaker) return { ok: false, error: "Speaker not found." };
  const req = speaker.requirements.find((r) => r.key === requirementKey);
  if (!req) return { ok: false, error: "Requirement not found." };
  req.done = !req.done;
  const allDone = speaker.requirements.every((r) => r.done);
  if (allDone && speaker.status !== "Canceled") speaker.status = "Ready";
  else if (!allDone && speaker.status === "Ready") {
    speaker.status = "Materials Pending";
  }
  const materialsDone = ["presentation", "bio", "headshot"].every(
    (k) => speaker.requirements.find((r) => r.key === k)?.done,
  );
  speaker.materialsStatus = materialsDone
    ? "complete"
    : speaker.requirements.some((r) =>
          ["presentation", "bio", "headshot"].includes(r.key) && r.done,
        )
      ? "pending"
      : "missing";
  revalidatePath(`/events/${speaker.eventId}/speakers`);
  return { ok: true, message: `${req.label} updated.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveLayoutVersion(input: {
  layoutId: string;
  items: RoomLayoutItem[];
  seatingCapacity: number;
  notes: string;
  actor: string;
  submitForApproval?: boolean;
}): Promise<ActionResult> {
  try {
    await requireAnyPermission(["vendor.portal", "events.operate"]);
  const layout = roomLayouts.find((l) => l.id === input.layoutId);
  if (!layout) return { ok: false, error: "Layout not found." };
  const current = roomLayoutVersions.find((v) => v.id === layout.currentVersionId);
  if (current?.status === "locked" || current?.status === "approved") {
    const nextVersion =
      Math.max(
        ...roomLayoutVersions
          .filter((v) => v.layoutId === layout.id)
          .map((v) => v.version),
        0,
      ) + 1;
    const id = `layv-${Date.now()}`;
    roomLayoutVersions.push({
      id,
      layoutId: layout.id,
      version: nextVersion,
      status: input.submitForApproval ? "pending_approval" : "draft",
      updatedAt: new Date().toISOString(),
      updatedBy: input.actor,
      notes: input.notes,
      items: input.items,
      seatingCapacity: input.seatingCapacity,
    });
    layout.currentVersionId = id;
  } else if (current) {
    current.items = input.items;
    current.seatingCapacity = input.seatingCapacity;
    current.notes = input.notes;
    current.updatedAt = new Date().toISOString();
    current.updatedBy = input.actor;
    if (input.submitForApproval) current.status = "pending_approval";
    else if (current.status !== "pending_approval") current.status = "draft";
  } else {
    return { ok: false, error: "No current version." };
  }
  revalidatePath(`/vendor/layouts/${layout.id}`);
  revalidatePath("/vendor");
  revalidatePath("/home");
  return {
    ok: true,
    message: input.submitForApproval
      ? "Layout submitted for approval."
      : "Layout draft saved.",
  };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setLayoutApproval(
  versionId: string,
  decision: "approved" | "rejected",
  actor: string,
): Promise<ActionResult> {
  try {
    await requirePermission("events.operate");
  const version = roomLayoutVersions.find((v) => v.id === versionId);
  if (!version) return { ok: false, error: "Version not found." };
  version.status = decision;
  version.updatedAt = new Date().toISOString();
  version.updatedBy = actor;
  const layout = roomLayouts.find((l) => l.id === version.layoutId);
  revalidatePath(`/vendor/layouts/${version.layoutId}`);
  revalidatePath("/vendor");
  if (layout) revalidatePath(`/events/${layout.eventId}`);
  return {
    ok: true,
    message: decision === "approved" ? "Layout approved." : "Layout rejected.",
  };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addLayoutObject(
  layoutId: string,
  type: LayoutObjectType,
  actor: string,
): Promise<ActionResult> {
  try {
    await requireAnyPermission(["vendor.portal", "events.operate"]);
  const layout = roomLayouts.find((l) => l.id === layoutId);
  if (!layout) return { ok: false, error: "Layout not found." };
  const version = roomLayoutVersions.find((v) => v.id === layout.currentVersionId);
  if (!version) return { ok: false, error: "No version." };
  if (version.status === "locked") {
    return { ok: false, error: "Layout is locked." };
  }
  version.items.push({
    id: `li-${Date.now()}`,
    type,
    label: type.replace(/_/g, " "),
    x: 80 + (version.items.length % 6) * 70,
    y: 80 + Math.floor(version.items.length / 6) * 60,
    w: type.includes("table") ? 50 : 60,
    h: type.includes("table") ? 50 : 40,
    rotation: 0,
  });
  version.updatedAt = new Date().toISOString();
  version.updatedBy = actor;
  if (version.status === "approved") version.status = "draft";
  revalidatePath(`/vendor/layouts/${layoutId}`);
  return { ok: true, message: "Object added." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function togglePersonalSession(
  registrationId: string,
  sessionId: string,
): Promise<ActionResult> {
  try {
    await requirePermission("attendee.portal");
  const idx = attendeeSessions.findIndex(
    (x) => x.registrationId === registrationId && x.sessionId === sessionId,
  );
  if (idx >= 0) {
    attendeeSessions.splice(idx, 1);
    revalidatePath("/attendee");
    revalidatePath("/home");
    return { ok: true, message: "Removed from personal schedule." };
  }
  attendeeSessions.push({ registrationId, sessionId });
  revalidatePath("/attendee");
  revalidatePath("/home");
  return { ok: true, message: "Added to personal schedule." };
  } catch (e) {
    return toActionError(e);
  }
}
