"use server";

import { redirect } from "next/navigation";
import {
  clearNeedsIntake,
  getSessionAppUser,
} from "@/features/users/session";
import { eventRequests } from "./seed";
import type { EventRequest, ReferralSource } from "./types";

export type RequestFormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      requestId?: string;
      showSurvey?: boolean;
    }
  | null;

export type SurveyState =
  | { error?: string; done?: boolean; skipped?: boolean }
  | null;

function requireCustomer() {
  return getSessionAppUser();
}

export async function submitEventRequestAction(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const user = await requireCustomer();
  if (!user) {
    return { error: "You must be signed in to submit a request." };
  }
  if (user.roleKey !== "customer") {
    return { error: "Only customer accounts can submit event requests." };
  }

  const organization = String(formData.get("organization") ?? "").trim();
  const eventName = String(formData.get("eventName") ?? "").trim();
  const eventType = String(formData.get("eventType") ?? "").trim();
  const preferredDate = String(formData.get("preferredDate") ?? "").trim();
  const estimatedGuestsRaw = String(formData.get("estimatedGuests") ?? "").trim();
  const venuePreference = String(formData.get("venuePreference") ?? "").trim();
  const budgetRange = String(formData.get("budgetRange") ?? "").trim();
  const messageToTeam = String(formData.get("messageToTeam") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!organization) fieldErrors.organization = "Organization is required.";
  if (!eventName) fieldErrors.eventName = "Event name is required.";
  if (!eventType) fieldErrors.eventType = "Select an event type.";
  if (!preferredDate) fieldErrors.preferredDate = "Preferred date is required.";
  if (!estimatedGuestsRaw) {
    fieldErrors.estimatedGuests = "Estimated guest count is required.";
  }
  const estimatedGuests = Number(estimatedGuestsRaw);
  if (
    estimatedGuestsRaw &&
    (!Number.isFinite(estimatedGuests) || estimatedGuests < 1)
  ) {
    fieldErrors.estimatedGuests = "Enter a valid guest count (1 or more).";
  }
  if (!venuePreference) {
    fieldErrors.venuePreference = "Venue preference is required.";
  }
  if (!budgetRange) fieldErrors.budgetRange = "Select a budget range.";
  if (!messageToTeam) {
    fieldErrors.messageToTeam = "Please include a message for our team.";
  } else if (messageToTeam.length < 10) {
    fieldErrors.messageToTeam = "Message should be at least 10 characters.";
  }

  if (Object.keys(fieldErrors).length) {
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }

  const request: EventRequest = {
    id: `req-${Date.now()}`,
    userId: user.id,
    contactName: user.fullName,
    contactEmail: user.email,
    contactPhone: user.phone ?? "",
    organization,
    eventName,
    eventType,
    preferredDate,
    estimatedGuests,
    venuePreference,
    budgetRange,
    messageToTeam,
    status: "submitted",
    createdAt: new Date().toISOString(),
  };
  eventRequests.push(request);
  await clearNeedsIntake(user.id);

  return { requestId: request.id, showSurvey: true };
}

export async function submitReferralSurveyAction(
  _prev: SurveyState,
  formData: FormData,
): Promise<SurveyState> {
  const user = await requireCustomer();
  if (!user) {
    return { error: "Session expired. Your request was still saved." };
  }

  const requestId = String(formData.get("requestId") ?? "");
  const source = String(formData.get("referralSource") ?? "") as ReferralSource;
  const otherText = String(formData.get("referralOtherText") ?? "").trim();

  const request = eventRequests.find(
    (r) => r.id === requestId && r.userId === user.id,
  );
  if (!request) {
    return {
      error: "Request not found, but you can continue to confirmation.",
      done: true,
    };
  }

  if (!source) {
    return { error: "Please select how you heard about us." };
  }
  if (source === "other" && !otherText) {
    return { error: "Please tell us more when selecting Other." };
  }

  request.referralSource = source;
  request.referralOtherText = source === "other" ? otherText : null;
  request.referralSubmittedAt = new Date().toISOString();
  request.referralSkipped = false;

  redirect(`/request/confirmation?id=${encodeURIComponent(request.id)}`);
}

export async function skipReferralSurveyAction(
  formData: FormData,
): Promise<void> {
  const user = await requireCustomer();
  const requestId = String(formData.get("requestId") ?? "");
  if (user && requestId) {
    const request = eventRequests.find(
      (r) => r.id === requestId && r.userId === user.id,
    );
    if (request) {
      request.referralSkipped = true;
      request.referralSource = null;
      request.referralOtherText = null;
    }
  }
  redirect(
    `/request/confirmation?id=${encodeURIComponent(requestId || "unknown")}`,
  );
}

export async function getRequestForCurrentUser(requestId: string) {
  const user = await requireCustomer();
  if (!user) return null;
  return (
    eventRequests.find((r) => r.id === requestId && r.userId === user.id) ??
    null
  );
}
