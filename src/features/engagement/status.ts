/**
 * Engagement inquiry status machine
 *
 * pending_approval
 *   └─(exec/PM approve + submit company quote)→ quote_sent
 * quote_sent
 *   ├─(customer deny)→ quote_denied
 *   └─(customer starts accept)→ awaiting_signature_deposit
 * quote_denied
 *   ├─(amend quote)→ quote_sent
 *   └─(terminate)→ terminated
 * awaiting_signature_deposit
 *   ├─(signed + deposit paid)→ customer_accepted → vendor_sourcing
 *   └─(incomplete) stays until both complete
 * vendor_sourcing
 *   └─(marked-up offer sent)→ vendor_offer_sent
 * vendor_offer_sent
 *   ├─(customer accept)→ completed (or stay sourcing for more packages)
 *   └─(customer reject)→ vendor_sourcing
 */

export const ENGAGEMENT_STATUSES = [
  "pending_approval",
  "quote_sent",
  "quote_denied",
  "awaiting_signature_deposit",
  "customer_accepted",
  "vendor_sourcing",
  "vendor_offer_sent",
  "completed",
  "terminated",
] as const;

export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

export function isEngagementStatus(v: unknown): v is EngagementStatus {
  return (
    typeof v === "string" &&
    (ENGAGEMENT_STATUSES as readonly string[]).includes(v)
  );
}

export const ENGAGEMENT_STATUS_LABELS: Record<EngagementStatus, string> = {
  pending_approval: "Pending approval",
  quote_sent: "Quote sent",
  quote_denied: "Quote denied",
  awaiting_signature_deposit: "Awaiting signature & deposit",
  customer_accepted: "Customer accepted",
  vendor_sourcing: "Vendor sourcing",
  vendor_offer_sent: "Vendor offer sent",
  completed: "Completed",
  terminated: "Terminated",
};

export const DEFAULT_DEPOSIT_PERCENT = 25;
