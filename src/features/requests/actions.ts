"use server";

import { redirect } from "next/navigation";
import {
  clearNeedsIntake,
  getSessionAppUser,
  getSessionUser,
} from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";
import { buildValuationRecommendation } from "@/features/valuation/recommend";
import { QUOTE_PACKAGES, type QuotePackageId } from "@/features/valuation/types";
import { createClient } from "@/lib/supabase/server";
import { ensureCustomerForOrganization } from "@/features/contracts/customers-demo";
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

export async function listEventRequestsForStaff(): Promise<EventRequest[]> {
  const session = await getSessionUser();
  if (!session) return [];
  if (!roleHasPermission(session.roleKey, "contracts.read")) return [];
  return [...eventRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getEventRequestById(
  id: string,
): Promise<EventRequest | null> {
  return eventRequests.find((r) => r.id === id) ?? null;
}

export async function listQuotesForCustomer(): Promise<EventRequest[]> {
  const user = await requireCustomer();
  if (!user || user.roleKey !== "customer") return [];
  return eventRequests
    .filter(
      (r) =>
        r.userId === user.id ||
        r.contactEmail.toLowerCase() === user.email.toLowerCase(),
    )
    .filter((r) => r.quote && (r.status === "quoted" || r.status === "accepted" || r.status === "changes_requested"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  // Persist into engagement workflow (Supabase) so exec/PM queues stay live.
  try {
    const customer = await ensureCustomerForOrganization({
      name: organization,
      billingEmail: user.email,
      phone: user.phone ?? "",
    });
    const supabase = createClient();
    await supabase.from("engagement_inquiries").insert({
      customer_id: customer.id,
      customer_user_email: user.email,
      organization,
      contact_name: user.fullName,
      contact_email: user.email,
      contact_phone: user.phone ?? "",
      event_name: eventName,
      event_type: eventType,
      preferred_start: preferredDate,
      preferred_end: null,
      location: venuePreference,
      guest_count: estimatedGuests,
      budget_range: budgetRange,
      description: messageToTeam,
      status: "pending_approval",
    });
    await supabase.from("engagement_notifications").insert({
      audience: "internal",
      title: "New customer inquiry awaiting approval",
      body: `${eventName} from ${organization} needs exec/PM approval and a company quote.`,
      href: "/engagement/approvals",
    });
  } catch {
    /* keep in-memory request even if Supabase write fails */
  }

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

export async function createQuoteForRequestAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Sign in required." };
  if (!roleHasPermission(session.roleKey, "contracts.write")) {
    return { ok: false, error: "Only contract managers can create quotes." };
  }

  const requestId = String(formData.get("requestId") ?? "");
  const packageId = String(formData.get("packageId") ?? "") as QuotePackageId;
  const customAmountRaw = String(formData.get("customAmount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const request = eventRequests.find((r) => r.id === requestId);
  if (!request) return { ok: false, error: "Request not found." };

  const pkg = QUOTE_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return { ok: false, error: "Select a quote package." };

  const rec = buildValuationRecommendation({
    eventType: request.eventType,
    guests: request.estimatedGuests,
  });

  let amount = Math.round(rec.totalMid * pkg.midMultiplier);
  if (packageId === "custom") {
    amount = Number(customAmountRaw);
    if (!Number.isFinite(amount) || amount < 1) {
      return { ok: false, error: "Enter a valid custom quote amount." };
    }
  }

  request.quote = {
    packageId,
    packageLabel: pkg.label,
    amount,
    notes,
    createdAt: new Date().toISOString(),
    createdBy: session.email,
    returnedAt: null,
  };
  request.status = "under_review";
  return { ok: true };
}

export async function returnQuoteToCustomerAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Sign in required." };
  if (!roleHasPermission(session.roleKey, "contracts.write")) {
    return { ok: false, error: "Only contract managers can return quotes." };
  }
  const requestId = String(formData.get("requestId") ?? "");
  const request = eventRequests.find((r) => r.id === requestId);
  if (!request?.quote) {
    return { ok: false, error: "Create a quote before returning it." };
  }
  request.quote.returnedAt = new Date().toISOString();
  request.status = "quoted";
  return { ok: true };
}

export async function customerRespondToQuoteAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const user = await requireCustomer();
  if (!user || user.roleKey !== "customer") {
    return { ok: false, error: "Customer sign-in required." };
  }
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const request = eventRequests.find(
    (r) =>
      r.id === requestId &&
      (r.userId === user.id ||
        r.contactEmail.toLowerCase() === user.email.toLowerCase()),
  );
  if (!request?.quote || request.status !== "quoted") {
    return { ok: false, error: "No open quote found." };
  }

  if (decision === "accept") {
    const linked = await ensureCustomerForOrganization({
      name: request.organization,
      billingEmail: request.contactEmail,
      phone: request.contactPhone,
    });
    request.linkedCustomerId = linked.id;
    request.status = "accepted";
    return { ok: true };
  }
  if (decision === "changes") {
    request.status = "changes_requested";
    return { ok: true };
  }
  return { ok: false, error: "Unknown decision." };
}
