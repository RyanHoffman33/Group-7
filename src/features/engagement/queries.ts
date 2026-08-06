import { createClient } from "@/lib/supabase/server";
import { isEngagementStatus } from "./status";
import type {
  CompanyQuote,
  CustomerFacingVendorOffer,
  CustomerVendorQuoteOffer,
  EngagementInquiry,
  EngagementNotification,
  EngagementSignature,
  NotificationAudience,
  QuoteLineItem,
  VendorQuote,
  VendorRfq,
  VendorRow,
} from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseLines(v: unknown): QuoteLineItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const description = String(r.description ?? "").trim();
      const amount = num(r.amount);
      if (!description || amount <= 0) return null;
      return { description, amount };
    })
    .filter((x): x is QuoteLineItem => Boolean(x));
}

function mapInquiry(row: Record<string, unknown>): EngagementInquiry {
  const status = isEngagementStatus(row.status) ? row.status : "pending_approval";
  return {
    id: String(row.id),
    customer_id: (row.customer_id as string | null) ?? null,
    customer_user_email: String(row.customer_user_email ?? ""),
    organization: String(row.organization ?? ""),
    contact_name: String(row.contact_name ?? ""),
    contact_email: String(row.contact_email ?? ""),
    contact_phone: String(row.contact_phone ?? ""),
    event_name: String(row.event_name ?? ""),
    event_type: String(row.event_type ?? ""),
    preferred_start: String(row.preferred_start ?? ""),
    preferred_end: (row.preferred_end as string | null) ?? null,
    location: String(row.location ?? ""),
    guest_count: row.guest_count != null ? Number(row.guest_count) : null,
    budget_range: String(row.budget_range ?? ""),
    description: String(row.description ?? ""),
    status,
    assigned_to: (row.assigned_to as string | null) ?? null,
    approved_by: (row.approved_by as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    contract_id: (row.contract_id as string | null) ?? null,
    deposit_id: (row.deposit_id as string | null) ?? null,
    terminate_reason: (row.terminate_reason as string | null) ?? null,
    terminated_at: (row.terminated_at as string | null) ?? null,
    terminated_by: (row.terminated_by as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapQuote(row: Record<string, unknown>): CompanyQuote {
  return {
    id: String(row.id),
    inquiry_id: String(row.inquiry_id),
    version: Number(row.version ?? 1),
    amount: num(row.amount),
    line_items: parseLines(row.line_items),
    notes: String(row.notes ?? ""),
    valid_until: (row.valid_until as string | null) ?? null,
    status: (row.status as CompanyQuote["status"]) ?? "draft",
    created_by: (row.created_by as string | null) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
  };
}

function mapOffer(row: Record<string, unknown>): CustomerVendorQuoteOffer {
  return {
    id: String(row.id),
    inquiry_id: String(row.inquiry_id),
    vendor_quote_id: String(row.vendor_quote_id),
    version: Number(row.version ?? 1),
    vendor_cost: num(row.vendor_cost),
    markup_percent: num(row.markup_percent),
    markup_amount: num(row.markup_amount),
    customer_price: num(row.customer_price),
    notes: String(row.notes ?? ""),
    status: (row.status as CustomerVendorQuoteOffer["status"]) ?? "draft",
    sent_by: (row.sent_by as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    decided_at: (row.decided_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
  };
}

export async function listInquiriesForCustomerEmail(
  email: string,
): Promise<EngagementInquiry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagement_inquiries")
    .select("*")
    .ilike("customer_user_email", email.trim())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapInquiry(r as Record<string, unknown>));
}

export async function listPendingApprovalInquiries(): Promise<
  EngagementInquiry[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagement_inquiries")
    .select("*")
    .in("status", ["pending_approval", "quote_denied"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapInquiry(r as Record<string, unknown>));
}

export async function listSourcingInquiries(): Promise<EngagementInquiry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagement_inquiries")
    .select("*")
    .in("status", [
      "customer_accepted",
      "vendor_sourcing",
      "vendor_offer_sent",
      "completed",
    ])
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapInquiry(r as Record<string, unknown>));
}

export async function listAllInquiriesForStaff(): Promise<EngagementInquiry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagement_inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => mapInquiry(r as Record<string, unknown>));
}

export async function getInquiryById(
  id: string,
): Promise<EngagementInquiry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagement_inquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapInquiry(data as Record<string, unknown>) : null;
}

export async function listQuotesForInquiry(
  inquiryId: string,
): Promise<CompanyQuote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_quotes")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapQuote(r as Record<string, unknown>));
}

export async function getLatestSubmittedQuote(
  inquiryId: string,
): Promise<CompanyQuote | null> {
  const quotes = await listQuotesForInquiry(inquiryId);
  return (
    quotes.find((q) =>
      ["submitted", "accepted", "denied"].includes(q.status),
    ) ?? null
  );
}

export async function listSignaturesForInquiry(
  inquiryId: string,
): Promise<EngagementSignature[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagement_signatures")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("signed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      inquiry_id: String(r.inquiry_id),
      related_quote_id: (r.related_quote_id as string | null) ?? null,
      signature_type: r.signature_type as EngagementSignature["signature_type"],
      signer_name: String(r.signer_name ?? ""),
      signer_email: String(r.signer_email ?? ""),
      signed_at: String(r.signed_at ?? ""),
      ip_address: (r.ip_address as string | null) ?? null,
      user_agent: (r.user_agent as string | null) ?? null,
    };
  });
}

export async function listVendors(): Promise<VendorRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("id, name, status, portal_email")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    status: String(r.status ?? "active"),
    portal_email: (r.portal_email as string | null) ?? null,
  }));
}

export async function resolveVendorIdsForPortalEmail(
  email: string,
): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("id")
    .ilike("portal_email", email.trim());
  if (error) throw error;
  return (data ?? []).map((r) => String(r.id));
}

export async function listRfqsForInquiry(
  inquiryId: string,
): Promise<VendorRfq[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendor_rfqs")
    .select("*, vendors(name)")
    .eq("inquiry_id", inquiryId)
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const vendors = r.vendors as { name?: string } | null;
    return {
      id: String(r.id),
      inquiry_id: String(r.inquiry_id),
      vendor_id: String(r.vendor_id),
      title: String(r.title ?? ""),
      message: String(r.message ?? ""),
      status: r.status as VendorRfq["status"],
      sent_by: (r.sent_by as string | null) ?? null,
      sent_at: String(r.sent_at ?? ""),
      created_at: String(r.created_at ?? ""),
      vendor_name: vendors?.name,
    };
  });
}

export async function listRfqsForVendorIds(
  vendorIds: string[],
): Promise<VendorRfq[]> {
  if (!vendorIds.length) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendor_rfqs")
    .select("*, vendors(name), engagement_inquiries(event_name)")
    .in("vendor_id", vendorIds)
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const vendors = r.vendors as { name?: string } | null;
    const inquiry = r.engagement_inquiries as { event_name?: string } | null;
    return {
      id: String(r.id),
      inquiry_id: String(r.inquiry_id),
      vendor_id: String(r.vendor_id),
      title: String(r.title ?? ""),
      message: String(r.message ?? ""),
      status: r.status as VendorRfq["status"],
      sent_by: (r.sent_by as string | null) ?? null,
      sent_at: String(r.sent_at ?? ""),
      created_at: String(r.created_at ?? ""),
      vendor_name: vendors?.name,
      inquiry_event_name: inquiry?.event_name,
    };
  });
}

export async function listVendorQuotesForInquiry(
  inquiryId: string,
): Promise<VendorQuote[]> {
  const supabase = createClient();
  const { data: rfqs } = await supabase
    .from("vendor_rfqs")
    .select("id")
    .eq("inquiry_id", inquiryId);
  const rfqIds = (rfqs ?? []).map((r) => String(r.id));
  if (!rfqIds.length) return [];

  const { data, error } = await supabase
    .from("vendor_quotes")
    .select("*, vendors(name), vendor_rfqs(title, inquiry_id)")
    .in("rfq_id", rfqIds)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const vendors = r.vendors as { name?: string } | null;
    const rfq = r.vendor_rfqs as { title?: string; inquiry_id?: string } | null;
    return {
      id: String(r.id),
      rfq_id: String(r.rfq_id),
      vendor_id: String(r.vendor_id),
      amount: num(r.amount),
      line_items: parseLines(r.line_items),
      notes: String(r.notes ?? ""),
      status: r.status as VendorQuote["status"],
      submitted_at: String(r.submitted_at ?? ""),
      created_at: String(r.created_at ?? ""),
      vendor_name: vendors?.name,
      rfq_title: rfq?.title,
      inquiry_id: rfq?.inquiry_id,
    };
  });
}

export async function listOffersForInquiry(
  inquiryId: string,
): Promise<CustomerVendorQuoteOffer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_vendor_quote_offers")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapOffer(r as Record<string, unknown>));
}

export async function listCustomerFacingOffers(
  email: string,
): Promise<CustomerFacingVendorOffer[]> {
  const inquiries = await listInquiriesForCustomerEmail(email);
  if (!inquiries.length) return [];
  const byId = new Map(inquiries.map((i) => [i.id, i]));
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_vendor_quote_offers")
    .select("id, inquiry_id, customer_price, notes, status, sent_at")
    .in(
      "inquiry_id",
      inquiries.map((i) => i.id),
    )
    .in("status", ["sent", "accepted", "rejected"])
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const inquiryId = String(r.inquiry_id);
    return {
      id: String(r.id),
      inquiry_id: inquiryId,
      customer_price: num(r.customer_price),
      notes: String(r.notes ?? ""),
      status: r.status as CustomerFacingVendorOffer["status"],
      sent_at: (r.sent_at as string | null) ?? null,
      event_name: byId.get(inquiryId)?.event_name,
    };
  });
}

export async function listNotifications(
  audience: NotificationAudience,
  limit = 30,
): Promise<EngagementNotification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagement_notifications")
    .select("*")
    .eq("audience", audience)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      inquiry_id: (r.inquiry_id as string | null) ?? null,
      audience: r.audience as NotificationAudience,
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      href: (r.href as string | null) ?? null,
      read_at: (r.read_at as string | null) ?? null,
      created_at: String(r.created_at ?? ""),
    };
  });
}

export async function countUnreadNotifications(
  audience: NotificationAudience,
): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("engagement_notifications")
    .select("id", { count: "exact", head: true })
    .eq("audience", audience)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function countPendingApprovals(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("engagement_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_approval");
  if (error) throw error;
  return count ?? 0;
}
