"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission } from "@/features/access/matrix";
import { ensureCustomerForOrganization } from "@/features/contracts/customers-demo";
import {
  clearNeedsIntake,
  getSessionAppUser,
  getSessionUser,
} from "@/features/users/session";
import {
  DEFAULT_DEPOSIT_PERCENT,
} from "./status";
import type {
  ActionResult,
  NotificationAudience,
  QuoteLineItem,
} from "./types";
import {
  getInquiryById,
  getLatestSubmittedQuote,
  listQuotesForInquiry,
  listSignaturesForInquiry,
} from "./queries";

function revalidateEngagement() {
  revalidatePath("/engagement/approvals");
  revalidatePath("/engagement/sourcing");
  revalidatePath("/dashboard/customer/engagement");
  revalidatePath("/dashboard/customer");
  revalidatePath("/vendor");
  revalidatePath("/vendor/rfqs");
  revalidatePath("/contracts");
  revalidatePath("/notifications");
}

async function notify(input: {
  inquiry_id?: string | null;
  audience: NotificationAudience;
  title: string;
  body: string;
  href?: string;
}) {
  const supabase = createClient();
  await supabase.from("engagement_notifications").insert({
    inquiry_id: input.inquiry_id ?? null,
    audience: input.audience,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
  });
}

function parseLineItemsFromForm(formData: FormData): QuoteLineItem[] {
  const raw = String(formData.get("lineItemsJson") ?? "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const r = row as Record<string, unknown>;
            const description = String(r.description ?? "").trim();
            const amount = Number(r.amount);
            if (!description || !Number.isFinite(amount) || amount <= 0) {
              return null;
            }
            return { description, amount };
          })
          .filter((x): x is QuoteLineItem => Boolean(x));
      }
    } catch {
      /* fall through */
    }
  }

  const descriptions = formData.getAll("lineDescription").map(String);
  const amounts = formData.getAll("lineAmount").map(String);
  const items: QuoteLineItem[] = [];
  for (let i = 0; i < Math.max(descriptions.length, amounts.length); i++) {
    const description = (descriptions[i] ?? "").trim();
    const amount = Number(amounts[i] ?? "");
    if (!description) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    items.push({ description, amount });
  }
  return items;
}

async function requireStaffContractsWrite() {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: "Sign in required." };
  if (
    !roleHasPermission(session.roleKey, "contracts.write") &&
    !roleHasPermission(session.roleKey, "contracts.approve_co") &&
    session.roleKey !== "executive" &&
    session.roleKey !== "project_manager" &&
    session.roleKey !== "system_admin"
  ) {
    return { ok: false as const, error: "Not authorized." };
  }
  return { ok: true as const, session };
}

async function clientMeta() {
  const h = await headers();
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown",
    ua: h.get("user-agent") || "unknown",
  };
}

async function nextEngagementContractNumber(): Promise<string> {
  const supabase = createClient();
  const { count } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true });
  const n = (count ?? 0) + 1;
  return `ME-ENG-${String(n).padStart(4, "0")}`;
}

export async function submitEngagementInquiryAction(
  _prev: { error?: string; fieldErrors?: Record<string, string>; id?: string } | null,
  formData: FormData,
): Promise<{ error?: string; fieldErrors?: Record<string, string>; id?: string }> {
  const user = await getSessionAppUser();
  if (!user || user.roleKey !== "customer") {
    return { error: "Only customer accounts can submit inquiries." };
  }

  const organization = String(formData.get("organization") ?? "").trim();
  const eventName = String(formData.get("eventName") ?? "").trim();
  const eventType = String(formData.get("eventType") ?? "").trim();
  const preferredStart = String(formData.get("preferredStart") ?? "").trim();
  const preferredEnd = String(formData.get("preferredEnd") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const guestRaw = String(formData.get("guestCount") ?? "").trim();
  const budgetRange = String(formData.get("budgetRange") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const contactPhone = String(
    formData.get("contactPhone") ?? user.phone ?? "",
  ).trim();

  const fieldErrors: Record<string, string> = {};
  if (!organization) fieldErrors.organization = "Organization is required.";
  if (!eventName) fieldErrors.eventName = "Event name is required.";
  if (!eventType) fieldErrors.eventType = "Select an event type.";
  if (!preferredStart) fieldErrors.preferredStart = "Start date is required.";
  if (!location) fieldErrors.location = "Location is required.";
  if (!budgetRange) fieldErrors.budgetRange = "Budget range is required.";
  if (!description || description.length < 10) {
    fieldErrors.description = "Please describe your event (10+ characters).";
  }
  const guestCount = guestRaw ? Number(guestRaw) : null;
  if (guestRaw && (!Number.isFinite(guestCount) || (guestCount ?? 0) < 1)) {
    fieldErrors.guestCount = "Enter a valid guest count.";
  }
  if (Object.keys(fieldErrors).length) {
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }

  const customer = await ensureCustomerForOrganization({
    name: organization,
    billingEmail: user.email,
    phone: contactPhone,
  });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagement_inquiries")
    .insert({
      customer_id: customer.id,
      customer_user_email: user.email,
      organization,
      contact_name: user.fullName,
      contact_email: user.email,
      contact_phone: contactPhone,
      event_name: eventName,
      event_type: eventType,
      preferred_start: preferredStart,
      preferred_end: preferredEnd || null,
      location,
      guest_count: guestCount,
      budget_range: budgetRange,
      description,
      status: "pending_approval",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await clearNeedsIntake(user.id);
  await notify({
    inquiry_id: data.id,
    audience: "internal",
    title: "New customer inquiry awaiting approval",
    body: `${eventName} from ${organization} needs exec/PM approval and a company quote.`,
    href: "/engagement/approvals",
  });

  revalidateEngagement();
  return { id: data.id as string };
}

/** Approve inquiry only when a company quote is submitted in the same action. */
export async function approveInquiryWithQuoteAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireStaffContractsWrite();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { session } = auth;

  const inquiryId = String(formData.get("inquiryId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const validUntil = String(formData.get("validUntil") ?? "").trim();
  const lumpSum = Number(amountRaw);
  const lineItems = parseLineItemsFromForm(formData);

  const inquiry = await getInquiryById(inquiryId);
  if (!inquiry) return { ok: false, error: "Inquiry not found." };
  if (!["pending_approval", "quote_denied"].includes(inquiry.status)) {
    return { ok: false, error: "Inquiry is not awaiting approval/amendment." };
  }

  let amount = lumpSum;
  if (lineItems.length) {
    amount = Math.round(lineItems.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: "Enter a lump-sum amount or at least one line item before approving.",
    };
  }

  const existing = await listQuotesForInquiry(inquiryId);
  const nextVersion =
    existing.reduce((m, q) => Math.max(m, q.version), 0) + 1;

  const supabase = createClient();
  if (existing.length) {
    await supabase
      .from("company_quotes")
      .update({ status: "superseded" })
      .eq("inquiry_id", inquiryId)
      .in("status", ["draft", "submitted", "denied"]);
  }

  const { data: quote, error: qErr } = await supabase
    .from("company_quotes")
    .insert({
      inquiry_id: inquiryId,
      version: nextVersion,
      amount,
      line_items: lineItems.length
        ? lineItems
        : [{ description: "Company event package", amount }],
      notes,
      valid_until: validUntil || null,
      status: "submitted",
      created_by: session.email,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (qErr) return { ok: false, error: qErr.message };

  const { error: uErr } = await supabase
    .from("engagement_inquiries")
    .update({
      status: "quote_sent",
      approved_by: session.email,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);
  if (uErr) return { ok: false, error: uErr.message };

  await notify({
    inquiry_id: inquiryId,
    audience: "customer",
    title: "Company quote ready for review",
    body: `Your quote for ${inquiry.event_name} is ready. Sign and pay the deposit to accept.`,
    href: "/dashboard/customer/engagement",
  });

  revalidateEngagement();
  return { ok: true, id: quote.id as string };
}

export async function denyCompanyQuoteAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionAppUser();
  if (!user || user.roleKey !== "customer") {
    return { ok: false, error: "Customer sign-in required." };
  }
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const inquiry = await getInquiryById(inquiryId);
  if (!inquiry || inquiry.customer_user_email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Inquiry not found." };
  }
  if (inquiry.status !== "quote_sent") {
    return { ok: false, error: "No open quote to deny." };
  }

  const quote = await getLatestSubmittedQuote(inquiryId);
  const supabase = createClient();
  if (quote) {
    await supabase
      .from("company_quotes")
      .update({ status: "denied" })
      .eq("id", quote.id);
  }
  await supabase
    .from("engagement_inquiries")
    .update({
      status: "quote_denied",
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  await notify({
    inquiry_id: inquiryId,
    audience: "internal",
    title: "Customer denied company quote",
    body: reason
      ? `${inquiry.event_name}: ${reason}`
      : `${inquiry.event_name} quote was denied. Amend or terminate.`,
    href: "/engagement/approvals",
  });

  revalidateEngagement();
  return { ok: true };
}

export async function terminateInquiryAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireStaffContractsWrite();
  if (!auth.ok) return { ok: false, error: auth.error };
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Terminated by staff";
  const inquiry = await getInquiryById(inquiryId);
  if (!inquiry) return { ok: false, error: "Inquiry not found." };

  const supabase = createClient();
  await supabase
    .from("engagement_inquiries")
    .update({
      status: "terminated",
      terminate_reason: reason,
      terminated_at: new Date().toISOString(),
      terminated_by: auth.session.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  await notify({
    inquiry_id: inquiryId,
    audience: "customer",
    title: "Engagement terminated",
    body: `${inquiry.event_name} was closed: ${reason}`,
    href: "/dashboard/customer/engagement",
  });

  revalidateEngagement();
  return { ok: true };
}

/**
 * Accept company quote: requires typed e-sign + deposit payment.
 * Creates contract + deposit; moves inquiry to vendor_sourcing.
 */
export async function acceptCompanyQuoteAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionAppUser();
  if (!user || user.roleKey !== "customer") {
    return { ok: false, error: "Customer sign-in required." };
  }

  const inquiryId = String(formData.get("inquiryId") ?? "");
  const signerName = String(formData.get("signerName") ?? "").trim();
  const payDeposit = String(formData.get("payDeposit") ?? "") === "on" ||
    String(formData.get("payDeposit") ?? "") === "true" ||
    String(formData.get("payDeposit") ?? "") === "1";

  if (!signerName || signerName.length < 2) {
    return { ok: false, error: "Type your full legal name to sign." };
  }
  if (!payDeposit) {
    return {
      ok: false,
      error: "You must authorize the down payment to accept the quote.",
    };
  }

  const inquiry = await getInquiryById(inquiryId);
  if (!inquiry || inquiry.customer_user_email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Inquiry not found." };
  }
  if (
    inquiry.status !== "quote_sent" &&
    inquiry.status !== "awaiting_signature_deposit"
  ) {
    return { ok: false, error: "Quote is not open for acceptance." };
  }

  const quote = await getLatestSubmittedQuote(inquiryId);
  if (!quote || quote.status !== "submitted") {
    return { ok: false, error: "No submitted quote found." };
  }

  const depositAmount =
    Math.round(quote.amount * (DEFAULT_DEPOSIT_PERCENT / 100) * 100) / 100;
  const meta = await clientMeta();
  const supabase = createClient();

  const customer = await ensureCustomerForOrganization({
    name: inquiry.organization,
    billingEmail: inquiry.contact_email,
    phone: inquiry.contact_phone,
  });

  let contractId = inquiry.contract_id;
  if (!contractId) {
    const contract_number = await nextEngagementContractNumber();
    const eventStart = `${inquiry.preferred_start}T18:00:00.000Z`;
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        customer_id: customer.id,
        contract_number,
        event_name: inquiry.event_name,
        event_type: inquiry.event_type,
        event_start: eventStart,
        event_end: inquiry.preferred_end
          ? `${inquiry.preferred_end}T23:00:00.000Z`
          : eventStart,
        venue_name: inquiry.location.slice(0, 120),
        venue_city: inquiry.location.includes(",")
          ? inquiry.location.split(",").pop()?.trim()
          : null,
        guest_count: inquiry.guest_count,
        project_manager_label: "Morgan Manager",
        billing_method: "fixed_price",
        contract_value: quote.amount,
        original_contract_value: quote.amount,
        change_order_value_total: 0,
        deposit_required: true,
        deposit_percent: DEFAULT_DEPOSIT_PERCENT,
        minimum_deposit_amount: depositAmount,
        requires_deposit_before_work: true,
        discount_amount: 0,
        discount_percent: 0,
        cancellation_policy_text:
          "Cancellation within 30 days incurs 50% of contract value.",
        cancellation_fee_percent: 50,
        status: "deposit_pending",
        performance_complete: false,
        involvement_model: "collaborative",
        notes: `Created from engagement inquiry ${inquiry.id.slice(0, 8)} (preliminary quote).`,
        approved_at: new Date().toISOString(),
        approved_by: inquiry.approved_by ?? "system",
      })
      .select("id")
      .single();
    if (cErr) return { ok: false, error: cErr.message };
    contractId = contract.id as string;

    if (quote.line_items.length) {
      await supabase.from("contract_line_items").insert(
        quote.line_items.map((li, i) => ({
          contract_id: contractId,
          line_number: i + 1,
          line_type: "service",
          description: li.description,
          quantity: 1,
          unit_rate: li.amount,
          amount: li.amount,
          sort_order: i,
        })),
      );
    }

    await supabase.from("contract_milestones").insert({
      contract_id: contractId,
      milestone_key: "event_completion",
      label: "Event completion",
      amount: quote.amount,
      due_date: inquiry.preferred_start,
      sequence_no: 1,
      milestone_type: "progress",
      percent_of_contract: 100,
    });
  }

  const sigs = await listSignaturesForInquiry(inquiryId);
  const hasPrelim = sigs.some((s) => s.signature_type === "preliminary_contract");
  if (!hasPrelim) {
    await supabase.from("engagement_signatures").insert({
      inquiry_id: inquiryId,
      related_quote_id: quote.id,
      signature_type: "preliminary_contract",
      signer_name: signerName,
      signer_email: user.email,
      ip_address: meta.ip,
      user_agent: meta.ua,
    });
  }

  let depositId = inquiry.deposit_id;
  if (!depositId) {
    const { data: dep, error: dErr } = await supabase
      .from("deposits")
      .insert({
        contract_id: contractId,
        customer_id: customer.id,
        amount: depositAmount,
        received_at: new Date().toISOString().slice(0, 10),
        status: "unearned",
      })
      .select("id")
      .single();
    if (dErr) return { ok: false, error: dErr.message };
    depositId = dep.id as string;

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: null,
      entry_type: "deposit_receive",
      debit: depositAmount,
      credit: 0,
      memo: `Engagement deposit — ${inquiry.event_name}`,
    });
  }

  await supabase
    .from("contracts")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("status", "deposit_pending");

  await supabase
    .from("company_quotes")
    .update({ status: "accepted" })
    .eq("id", quote.id);

  await supabase
    .from("engagement_inquiries")
    .update({
      status: "vendor_sourcing",
      customer_id: customer.id,
      contract_id: contractId,
      deposit_id: depositId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  await notify({
    inquiry_id: inquiryId,
    audience: "internal",
    title: "Customer accepted — start vendor sourcing",
    body: `${inquiry.event_name} is signed with deposit. Open Vendor Sourcing to send RFQs.`,
    href: "/engagement/sourcing",
  });

  revalidateEngagement();
  return { ok: true, id: contractId ?? undefined };
}

export async function sendVendorRfqAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireStaffContractsWrite();
  if (!auth.ok) return { ok: false, error: auth.error };

  const inquiryId = String(formData.get("inquiryId") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const inquiry = await getInquiryById(inquiryId);
  if (!inquiry) return { ok: false, error: "Inquiry not found." };
  if (
    !["customer_accepted", "vendor_sourcing", "vendor_offer_sent"].includes(
      inquiry.status,
    )
  ) {
    return { ok: false, error: "Inquiry is not in vendor sourcing." };
  }
  if (!vendorId || !title) {
    return { ok: false, error: "Vendor and title are required." };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendor_rfqs")
    .insert({
      inquiry_id: inquiryId,
      vendor_id: vendorId,
      title,
      message,
      status: "sent",
      sent_by: auth.session.email,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (inquiry.status === "customer_accepted") {
    await supabase
      .from("engagement_inquiries")
      .update({
        status: "vendor_sourcing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiryId);
  }

  await notify({
    inquiry_id: inquiryId,
    audience: "vendor",
    title: `New RFQ: ${title}`,
    body: message || `MainEvent requested a quote for ${inquiry.event_name}.`,
    href: "/vendor/rfqs",
  });

  revalidateEngagement();
  return { ok: true, id: data.id as string };
}

export async function submitVendorQuoteAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Sign in required." };
  if (
    session.roleKey !== "vendor" &&
    session.roleKey !== "project_manager" &&
    session.roleKey !== "system_admin"
  ) {
    return { ok: false, error: "Vendor portal access required." };
  }

  const rfqId = String(formData.get("rfqId") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const notes = String(formData.get("notes") ?? "").trim();
  const lineItems = parseLineItemsFromForm(formData);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a valid quote amount." };
  }

  const supabase = createClient();
  const { data: rfq, error: rErr } = await supabase
    .from("vendor_rfqs")
    .select("*, vendors(portal_email), engagement_inquiries(event_name)")
    .eq("id", rfqId)
    .maybeSingle();
  if (rErr || !rfq) return { ok: false, error: "RFQ not found." };

  if (session.roleKey === "vendor") {
    const portal = (
      (rfq.vendors as { portal_email?: string | null } | null)?.portal_email ?? ""
    ).toLowerCase();
    if (portal !== session.email.toLowerCase()) {
      return { ok: false, error: "This RFQ is not assigned to your vendor account." };
    }
  }

  const { data: quote, error } = await supabase
    .from("vendor_quotes")
    .insert({
      rfq_id: rfqId,
      vendor_id: rfq.vendor_id,
      amount,
      line_items: lineItems.length
        ? lineItems
        : [{ description: "Vendor services", amount }],
      notes,
      status: "submitted",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("vendor_rfqs")
    .update({ status: "quoted" })
    .eq("id", rfqId);

  const eventName =
    (rfq.engagement_inquiries as { event_name?: string } | null)?.event_name ??
    "engagement";

  await notify({
    inquiry_id: String(rfq.inquiry_id),
    audience: "internal",
    title: "Vendor quote received",
    body: `A vendor quote ($${amount.toLocaleString()}) arrived for ${eventName}. Review markup in Vendor Sourcing.`,
    href: "/engagement/sourcing",
  });

  revalidateEngagement();
  return { ok: true, id: quote.id as string };
}

export async function sendMarkedUpVendorOfferAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireStaffContractsWrite();
  if (!auth.ok) return { ok: false, error: auth.error };

  const inquiryId = String(formData.get("inquiryId") ?? "");
  const vendorQuoteId = String(formData.get("vendorQuoteId") ?? "");
  const markupPercent = Number(String(formData.get("markupPercent") ?? "20"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(markupPercent) || markupPercent < 0) {
    return { ok: false, error: "Enter a valid markup percent." };
  }

  const inquiry = await getInquiryById(inquiryId);
  if (!inquiry) return { ok: false, error: "Inquiry not found." };

  const supabase = createClient();
  const { data: vq, error: vErr } = await supabase
    .from("vendor_quotes")
    .select("*")
    .eq("id", vendorQuoteId)
    .maybeSingle();
  if (vErr || !vq) return { ok: false, error: "Vendor quote not found." };

  const vendorCost = Number(vq.amount);
  const markupAmount =
    Math.round(vendorCost * (markupPercent / 100) * 100) / 100;
  const customerPrice =
    Math.round((vendorCost + markupAmount) * 100) / 100;

  await supabase
    .from("customer_vendor_quote_offers")
    .update({ status: "superseded" })
    .eq("inquiry_id", inquiryId)
    .eq("vendor_quote_id", vendorQuoteId)
    .in("status", ["draft", "sent"]);

  const { data: existing } = await supabase
    .from("customer_vendor_quote_offers")
    .select("version")
    .eq("inquiry_id", inquiryId)
    .eq("vendor_quote_id", vendorQuoteId)
    .order("version", { ascending: false })
    .limit(1);
  const version = (existing?.[0]?.version ?? 0) + 1;

  const { data: offer, error } = await supabase
    .from("customer_vendor_quote_offers")
    .insert({
      inquiry_id: inquiryId,
      vendor_quote_id: vendorQuoteId,
      version,
      vendor_cost: vendorCost,
      markup_percent: markupPercent,
      markup_amount: markupAmount,
      customer_price: customerPrice,
      notes:
        notes ||
        "Vendor package for your event (customer-facing price).",
      status: "sent",
      sent_by: auth.session.email,
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("vendor_quotes")
    .update({ status: "selected" })
    .eq("id", vendorQuoteId);

  await supabase
    .from("engagement_inquiries")
    .update({
      status: "vendor_offer_sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  await notify({
    inquiry_id: inquiryId,
    audience: "customer",
    title: "Vendor package ready for review",
    body: `A package for ${inquiry.event_name} is ready for your sign-off.`,
    href: "/dashboard/customer/engagement",
  });

  revalidateEngagement();
  return { ok: true, id: offer.id as string };
}

export async function decideVendorOfferAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getSessionAppUser();
  if (!user || user.roleKey !== "customer") {
    return { ok: false, error: "Customer sign-in required." };
  }

  const offerId = String(formData.get("offerId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const signerName = String(formData.get("signerName") ?? "").trim();

  const supabase = createClient();
  const { data: offer, error } = await supabase
    .from("customer_vendor_quote_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (error || !offer) return { ok: false, error: "Offer not found." };
  if (offer.status !== "sent") {
    return { ok: false, error: "Offer is not open." };
  }

  const inquiry = await getInquiryById(String(offer.inquiry_id));
  if (!inquiry || inquiry.customer_user_email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Not authorized for this offer." };
  }

  if (decision === "reject") {
    await supabase
      .from("customer_vendor_quote_offers")
      .update({
        status: "rejected",
        decided_at: new Date().toISOString(),
      })
      .eq("id", offerId);

    await supabase
      .from("engagement_inquiries")
      .update({
        status: "vendor_sourcing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiry.id);

    await notify({
      inquiry_id: inquiry.id,
      audience: "internal",
      title: "Customer rejected vendor package",
      body: `${inquiry.event_name}: re-inquire vendors or amend markup.`,
      href: "/engagement/sourcing",
    });

    revalidateEngagement();
    return { ok: true };
  }

  if (decision !== "accept") {
    return { ok: false, error: "Unknown decision." };
  }
  if (!signerName || signerName.length < 2) {
    return { ok: false, error: "Type your full legal name to sign off." };
  }

  const meta = await clientMeta();
  await supabase.from("engagement_signatures").insert({
    inquiry_id: inquiry.id,
    related_quote_id: offerId,
    signature_type: "vendor_offer",
    signer_name: signerName,
    signer_email: user.email,
    ip_address: meta.ip,
    user_agent: meta.ua,
  });

  await supabase
    .from("customer_vendor_quote_offers")
    .update({
      status: "accepted",
      decided_at: new Date().toISOString(),
    })
    .eq("id", offerId);

  // Amend contract value from preliminary estimate → agreed marked-up amount
  if (inquiry.contract_id) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("contract_value, original_contract_value, change_order_value_total")
      .eq("id", inquiry.contract_id)
      .maybeSingle();

    if (contract) {
      const prior = Number(contract.contract_value ?? 0);
      const customerPrice = Number(offer.customer_price);
      // Replace preliminary package with vendor-amended value when this is additive catering,
      // or set contract to max(prior, customerPrice) for demo clarity: add delta as CO.
      const priceChange = Math.round((customerPrice) * 100) / 100;
      // Treat accepted vendor package as a change order adjusting CV toward package + base.
      // Demo: set new CV = prior company quote retained as base OR replace with customer_price
      // if prior was preliminary lump and package supersedes a line — use prior + customer_price
      // when prior already includes production package (seed case): update to prior - 0 + markup package
      // Simpler demo rule: new_cv = prior + customer_price when offer notes catering; else = customer_price.
      const newCv = Math.round((prior + customerPrice) * 100) / 100;
      const delta = Math.round((newCv - prior) * 100) / 100;

      const { data: mod } = await supabase
        .from("contract_modifications")
        .insert({
          contract_id: inquiry.contract_id,
          mod_number: `CO-ENG-${Date.now().toString().slice(-6)}`,
          effective_date: new Date().toISOString().slice(0, 10),
          description: `Customer accepted vendor package ($${customerPrice.toLocaleString()})`,
          price_change: delta,
          prior_contract_value: prior,
          new_contract_value: newCv,
          scope_change_notes: "Vendor package accepted via customer portal e-sign.",
          accounting_treatment: "prospective",
          status: "approved",
          approved_by: user.email,
          approved_at: new Date().toISOString(),
          applied_at: new Date().toISOString(),
          requested_by: user.email,
          reason_code: "vendor_package_accept",
        })
        .select("id")
        .single();

      await supabase
        .from("contracts")
        .update({
          contract_value: newCv,
          change_order_value_total:
            Number(contract.change_order_value_total ?? 0) + delta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inquiry.contract_id);

      if (mod?.id) {
        await supabase.from("contract_audit_events").insert({
          contract_id: inquiry.contract_id,
          event_type: "vendor_offer_accepted",
          summary: `Contract value ${prior} → ${newCv} (mod ${mod.id})`,
          actor_label: user.email,
          payload: { prior, new_cv: newCv, modification_id: mod.id },
        });
      }
    }
  }

  await supabase
    .from("engagement_inquiries")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiry.id);

  await notify({
    inquiry_id: inquiry.id,
    audience: "internal",
    title: "Customer accepted vendor package",
    body: `${inquiry.event_name} vendor package signed; contract value updated.`,
    href: `/contracts/${inquiry.contract_id ?? ""}`,
  });

  revalidateEngagement();
  if (inquiry.contract_id) {
    revalidatePath(`/contracts/${inquiry.contract_id}`);
  }
  return { ok: true };
}

export async function markNotificationReadAction(
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing id." };
  const supabase = createClient();
  await supabase
    .from("engagement_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/notifications");
  revalidatePath("/engagement/approvals");
  revalidatePath("/vendor/rfqs");
  return { ok: true };
}
