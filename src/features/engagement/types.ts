import type { EngagementStatus } from "./status";

export type QuoteLineItem = {
  description: string;
  amount: number;
};

export type CompanyQuoteStatus =
  | "draft"
  | "submitted"
  | "superseded"
  | "accepted"
  | "denied";

export type VendorRfqStatus = "sent" | "quoted" | "declined" | "closed";

export type VendorQuoteStatus =
  | "submitted"
  | "selected"
  | "rejected"
  | "superseded";

export type VendorOfferStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "superseded";

export type NotificationAudience = "internal" | "customer" | "vendor";

export type SignatureType = "preliminary_contract" | "vendor_offer";

export interface EngagementInquiry {
  id: string;
  customer_id: string | null;
  customer_user_email: string;
  organization: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  event_name: string;
  event_type: string;
  preferred_start: string;
  preferred_end: string | null;
  location: string;
  guest_count: number | null;
  budget_range: string;
  description: string;
  status: EngagementStatus;
  assigned_to: string | null;
  approved_by: string | null;
  approved_at: string | null;
  contract_id: string | null;
  deposit_id: string | null;
  terminate_reason: string | null;
  terminated_at: string | null;
  terminated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyQuote {
  id: string;
  inquiry_id: string;
  version: number;
  amount: number;
  line_items: QuoteLineItem[];
  notes: string;
  valid_until: string | null;
  status: CompanyQuoteStatus;
  created_by: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface EngagementSignature {
  id: string;
  inquiry_id: string;
  related_quote_id: string | null;
  signature_type: SignatureType;
  signer_name: string;
  signer_email: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface VendorRow {
  id: string;
  name: string;
  status: string;
  portal_email: string | null;
}

export interface VendorRfq {
  id: string;
  inquiry_id: string;
  vendor_id: string;
  title: string;
  message: string;
  status: VendorRfqStatus;
  sent_by: string | null;
  sent_at: string;
  created_at: string;
  vendor_name?: string;
  inquiry_event_name?: string;
}

export interface VendorQuote {
  id: string;
  rfq_id: string;
  vendor_id: string;
  amount: number;
  line_items: QuoteLineItem[];
  notes: string;
  status: VendorQuoteStatus;
  submitted_at: string;
  created_at: string;
  vendor_name?: string;
  rfq_title?: string;
  inquiry_id?: string;
}

export interface CustomerVendorQuoteOffer {
  id: string;
  inquiry_id: string;
  vendor_quote_id: string;
  version: number;
  vendor_cost: number;
  markup_percent: number;
  markup_amount: number;
  customer_price: number;
  notes: string;
  status: VendorOfferStatus;
  sent_by: string | null;
  sent_at: string | null;
  decided_at: string | null;
  created_at: string;
}

/** Customer-safe view — never includes vendor_cost / markup. */
export interface CustomerFacingVendorOffer {
  id: string;
  inquiry_id: string;
  customer_price: number;
  notes: string;
  status: VendorOfferStatus;
  sent_at: string | null;
  event_name?: string;
}

export interface EngagementNotification {
  id: string;
  inquiry_id: string | null;
  audience: NotificationAudience;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export type ActionResult = {
  ok: boolean;
  error?: string;
  id?: string;
};

export const EVENT_TYPE_OPTIONS = [
  { value: "corporate_conference", label: "Corporate conference" },
  { value: "gala", label: "Gala / appreciation" },
  { value: "product_launch", label: "Product launch" },
  { value: "wedding", label: "Wedding" },
  { value: "fundraiser", label: "Fundraiser" },
  { value: "other", label: "Other" },
] as const;

export const BUDGET_RANGE_OPTIONS = [
  "Under $10,000",
  "$10,000 – $25,000",
  "$25,000 – $75,000",
  "$75,000 – $150,000",
  "$150,000+",
  "Not sure yet",
] as const;
