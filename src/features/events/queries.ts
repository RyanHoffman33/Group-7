import {
  announcements,
  attendeeSessions,
  attendees,
  calendarItems,
  checkIns,
  emailCampaigns,
  eventDocuments,
  eventIssues,
  eventTasks,
  novatechFunnel,
  opsEvents,
  qrCodes,
  registrations,
  roomLayouts,
  roomLayoutVersions,
  sessions,
  speakers,
  vendorAssignments,
  buildQrPayload,
} from "./seed";
import type {
  Attendee,
  CalendarItem,
  CheckIn,
  EmailCampaign,
  EventDocument,
  EventIssue,
  EventTask,
  OpsEvent,
  QrCodeRecord,
  Registration,
  RoomLayout,
  RoomLayoutVersion,
  Session,
  Speaker,
  VendorAssignment,
} from "./types";
import { speakerReadiness } from "./types";

export async function listOpsEvents(): Promise<OpsEvent[]> {
  return [...opsEvents];
}

export async function getOpsEvent(id: string): Promise<OpsEvent | undefined> {
  return opsEvents.find((e) => e.id === id);
}

export async function listRegistrations(eventId?: string): Promise<Registration[]> {
  return eventId
    ? registrations.filter((r) => r.eventId === eventId)
    : [...registrations];
}

export async function listAttendees(): Promise<Attendee[]> {
  return [...attendees];
}

export function getAttendee(id: string): Attendee | undefined {
  return attendees.find((a) => a.id === id);
}

export async function getAttendeeByUserId(
  userId: string,
): Promise<Attendee | undefined> {
  return attendees.find((a) => a.userId === userId);
}

export async function getAttendeePortal(userId: string) {
  const attendee = await getAttendeeByUserId(userId);
  if (!attendee) return null;
  const regs = registrations.filter((r) => r.attendeeId === attendee.id);
  const primary =
    regs.find((r) => r.eventId === "evt-ops-1" && r.status !== "canceled") ??
    regs[0];
  if (!primary) return null;
  const event = opsEvents.find((e) => e.id === primary.eventId)!;
  const qr = qrCodes.find(
    (q) => q.registrationId === primary.id && q.status === "active",
  );
  const checkIn = checkIns.find((c) => c.registrationId === primary.id);
  const eventSessions = sessions.filter(
    (s) => s.eventId === event.id && s.status === "published",
  );
  const mySessionIds = new Set(
    attendeeSessions
      .filter((x) => x.registrationId === primary.id)
      .map((x) => x.sessionId),
  );
  const publicSpeakers = speakers.filter(
    (s) => s.eventId === event.id && s.publicVisible && s.status !== "Canceled",
  );
  const docs = eventDocuments.filter(
    (d) => d.eventId === event.id && d.publicToAttendee,
  );
  const anns = announcements.filter((a) => a.eventId === event.id);

  return {
    attendee,
    registration: primary,
    event,
    qr,
    checkIn,
    sessions: eventSessions,
    mySessionIds,
    speakers: publicSpeakers,
    documents: docs,
    announcements: anns,
  };
}

export async function listQrCodes(eventId: string): Promise<
  Array<
    QrCodeRecord & {
      attendeeName: string;
      registrationType: string;
      registrationStatus: string;
      checkIn?: CheckIn;
    }
  >
> {
  return qrCodes
    .filter((q) => q.eventId === eventId)
    .map((q) => {
      const reg = registrations.find((r) => r.id === q.registrationId);
      const att = attendees.find((a) => a.id === q.attendeeId);
      const checkIn = checkIns.find((c) => c.registrationId === q.registrationId);
      return {
        ...q,
        attendeeName: att?.fullName ?? q.attendeeId,
        registrationType: reg?.registrationType ?? "—",
        registrationStatus: reg?.status ?? "—",
        checkIn,
      };
    });
}

export async function listEmails(eventId: string): Promise<EmailCampaign[]> {
  return emailCampaigns.filter((e) => e.eventId === eventId);
}

export async function getEmail(id: string): Promise<EmailCampaign | undefined> {
  return emailCampaigns.find((e) => e.id === id);
}

export async function listSpeakers(eventId: string): Promise<Speaker[]> {
  return speakers.filter((s) => s.eventId === eventId);
}

export async function listSessions(eventId: string): Promise<Session[]> {
  return sessions.filter((s) => s.eventId === eventId);
}

export async function listCalendarItems(eventId: string): Promise<CalendarItem[]> {
  return calendarItems
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function listEventTasks(eventId: string): Promise<EventTask[]> {
  return eventTasks.filter((t) => t.eventId === eventId);
}

export async function listEventIssues(eventId: string): Promise<EventIssue[]> {
  return eventIssues.filter((i) => i.eventId === eventId);
}

export async function listEventDocuments(
  eventId: string,
): Promise<EventDocument[]> {
  return eventDocuments.filter((d) => d.eventId === eventId);
}

export async function listVendorAssignments(
  vendorUserId?: string,
): Promise<VendorAssignment[]> {
  return vendorUserId
    ? vendorAssignments.filter((v) => v.vendorUserId === vendorUserId)
    : [...vendorAssignments];
}

export async function listRoomLayouts(eventId?: string): Promise<RoomLayout[]> {
  return eventId
    ? roomLayouts.filter((l) => l.eventId === eventId)
    : [...roomLayouts];
}

export async function getRoomLayout(
  layoutId: string,
): Promise<
  | {
      layout: RoomLayout;
      versions: RoomLayoutVersion[];
      current: RoomLayoutVersion | undefined;
    }
  | undefined
> {
  const layout = roomLayouts.find((l) => l.id === layoutId);
  if (!layout) return undefined;
  const versions = roomLayoutVersions
    .filter((v) => v.layoutId === layoutId)
    .sort((a, b) => b.version - a.version);
  const current = versions.find((v) => v.id === layout.currentVersionId);
  return { layout, versions, current };
}

export async function getCoordinatorSnapshot(eventId: string) {
  const [tasks, calendar, speakerList, emails, issues] = await Promise.all([
    listEventTasks(eventId),
    listCalendarItems(eventId),
    listSpeakers(eventId),
    listEmails(eventId),
    listEventIssues(eventId),
  ]);
  const overdue = tasks.filter((t) => t.status === "overdue");
  const openTasks = tasks.filter((t) => t.status !== "done");
  const notReady = speakerList.filter(
    (s) => s.status !== "Canceled" && speakerReadiness(s).pct < 100,
  );
  const draftEmails = emails.filter(
    (e) => e.status === "draft" || e.status === "pending_approval",
  );
  return {
    overdue,
    openTasks,
    calendar,
    notReadySpeakers: notReady,
    draftEmails,
    openIssues: issues.filter((i) => i.status === "open"),
  };
}

export async function getRegistrationMetrics(eventId: string) {
  const regs = registrations.filter((r) => r.eventId === eventId);
  const event = opsEvents.find((e) => e.id === eventId);
  const checkedIn = regs.filter((r) =>
    ["checked_in", "attended"].includes(r.status),
  ).length;
  const registered = regs.filter((r) =>
    ["registered", "confirmed", "checked_in", "attended"].includes(r.status),
  ).length;
  const canceled = regs.filter((r) => r.status === "canceled").length;
  const waitlisted = regs.filter((r) => r.status === "waitlisted").length;
  const noShows = regs.filter((r) => r.status === "no_show").length;

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const r of regs) {
    byType[r.registrationType] = (byType[r.registrationType] ?? 0) + 1;
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  const capacity = event?.capacity ?? 0;
  const attendanceRate =
    registered > 0 ? Math.round((checkedIn / registered) * 100) : 0;

  return {
    totalInvitations:
      eventId === "evt-ops-1" ? novatechFunnel.invitationsSent : regs.length + 40,
    registrations: registered,
    confirmed: regs.filter((r) => r.status === "confirmed").length,
    checkedIn,
    attendanceRate,
    canceled,
    waitlisted,
    noShows,
    capacity,
    remaining: Math.max(0, capacity - registered),
    byType,
    bySource,
    byStatus,
    funnel:
      eventId === "evt-ops-1"
        ? novatechFunnel
        : {
            invitationsSent: regs.length + 40,
            invitationsOpened: regs.length + 30,
            websiteVisitors: regs.length + 20,
            registrationVisitors: regs.length + 10,
            registrations: registered,
            attendance: checkedIn,
          },
  };
}

export { buildQrPayload };
