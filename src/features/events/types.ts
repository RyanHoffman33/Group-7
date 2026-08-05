export type RegistrationStatus =
  | "invited"
  | "registered"
  | "confirmed"
  | "waitlisted"
  | "checked_in"
  | "attended"
  | "no_show"
  | "canceled";

export type QrStatus = "active" | "inactive" | "regenerated" | "canceled";

export type EmailCampaignStatus =
  | "draft"
  | "pending_approval"
  | "scheduled"
  | "simulated_sent"
  | "canceled";

export type SpeakerStatus =
  | "Invited"
  | "Awaiting Confirmation"
  | "Confirmed"
  | "Materials Pending"
  | "AV Review Needed"
  | "Ready"
  | "Completed"
  | "Canceled";

export interface OpsEvent {
  id: string;
  contractId: string;
  name: string;
  customerName: string;
  startAt: string;
  endAt: string;
  venue: string;
  address: string;
  capacity: number;
  status: "planning" | "upcoming" | "live" | "completed";
  projectManager: string;
  coordinator: string;
}

export interface Attendee {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  userId?: string;
}

export interface Registration {
  id: string;
  eventId: string;
  attendeeId: string;
  registrationType: "Professional" | "Exhibitor" | "Staff" | "Executive" | "Guest";
  status: RegistrationStatus;
  source: "Website" | "Email" | "Social" | "Referral";
  registeredAt: string | null;
}

export interface QrCodeRecord {
  id: string;
  registrationId: string;
  eventId: string;
  attendeeId: string;
  status: QrStatus;
  payload: string;
  regeneratedFromId?: string;
  createdAt: string;
  createdBy: string;
}

export interface CheckIn {
  id: string;
  registrationId: string;
  eventId: string;
  attendeeId: string;
  checkedInAt: string;
  checkedInBy: string;
  method: "manual" | "qr_scan" | "kiosk";
  overrideDuplicate?: boolean;
}

export interface EmailCampaign {
  id: string;
  eventId: string;
  name: string;
  audienceType: string;
  emailType: string;
  status: EmailCampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  createdBy: string;
  lastModified: string;
  recipientCount: number;
  openCount: number;
  template: string;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  fromAddress?: string;
  toAudience?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  bodyHtml?: string;
}

export interface SpeakerRequirement {
  key: string;
  label: string;
  done: boolean;
}

export interface Speaker {
  id: string;
  eventId: string;
  name: string;
  title: string;
  organization: string;
  bio: string;
  status: SpeakerStatus;
  publicVisible: boolean;
  privateEmail?: string;
  arrivalTime?: string;
  avRequirements?: string;
  materialsStatus: "complete" | "pending" | "missing";
  sessionTitle?: string;
  room?: string;
  speakingAt?: string;
  greenRoom?: string;
  supportContact?: string;
  requirements: SpeakerRequirement[];
}

export interface Session {
  id: string;
  eventId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  room: string;
  capacity: number;
  status: "draft" | "published" | "canceled";
  speakerIds: string[];
  category?: string;
}

export interface AttendeeSession {
  registrationId: string;
  sessionId: string;
}

export interface EventAnnouncement {
  id: string;
  eventId: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface EventDocument {
  id: string;
  eventId: string;
  name: string;
  kind: string;
  publicToAttendee: boolean;
  awaitingUpload?: boolean;
}

export interface RegistrationFunnel {
  invitationsSent: number;
  invitationsOpened: number;
  websiteVisitors: number;
  registrationVisitors: number;
  registrations: number;
  attendance: number;
}

export type CalendarCategory =
  | "event"
  | "task"
  | "session"
  | "vendor"
  | "setup"
  | "teardown"
  | "meeting"
  | "email"
  | "checkin"
  | "milestone";

export interface CalendarItem {
  id: string;
  eventId: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  assignee: string;
  status: "open" | "in_progress" | "done" | "blocked";
  category: CalendarCategory;
  notes?: string;
}

export interface EventTask {
  id: string;
  eventId: string;
  title: string;
  dueAt: string;
  assignee: string;
  status: "open" | "overdue" | "done";
  priority: "low" | "medium" | "high";
}

export interface EventIssue {
  id: string;
  eventId: string;
  title: string;
  severity: "low" | "medium" | "high";
  status: "open" | "resolved";
  reportedBy: string;
}

export type LayoutApprovalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "locked";

export type LayoutObjectType =
  | "round_table"
  | "rect_table"
  | "chair"
  | "stage"
  | "podium"
  | "screen"
  | "speaker"
  | "dance_floor"
  | "registration_desk"
  | "catering"
  | "bar"
  | "booth"
  | "entrance"
  | "exit"
  | "restroom"
  | "av_control";

export interface RoomLayoutItem {
  id: string;
  type: LayoutObjectType;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface RoomLayoutVersion {
  id: string;
  layoutId: string;
  version: number;
  status: LayoutApprovalStatus;
  updatedAt: string;
  updatedBy: string;
  notes: string;
  items: RoomLayoutItem[];
  seatingCapacity: number;
}

export interface RoomLayout {
  id: string;
  eventId: string;
  vendorUserId: string;
  roomName: string;
  widthFt: number;
  heightFt: number;
  capacity: number;
  layoutType:
    | "Banquet"
    | "Theater"
    | "Classroom"
    | "Conference"
    | "Reception"
    | "Trade Show"
    | "Custom";
  currentVersionId: string;
}

export interface VendorAssignment {
  id: string;
  vendorUserId: string;
  vendorName: string;
  eventId: string;
  arrivalTime: string;
  loadIn: string;
  contact: string;
  workOrder: string;
  invoiceStatus: string;
  completionStatus: string;
}

export function speakerReadiness(speaker: Speaker): {
  pct: number;
  missing: string[];
} {
  const reqs = speaker.requirements ?? [];
  if (!reqs.length) return { pct: 0, missing: ["No checklist configured"] };
  const done = reqs.filter((r) => r.done).length;
  const missing = reqs.filter((r) => !r.done).map((r) => r.label);
  return { pct: Math.round((done / reqs.length) * 100), missing };
}
