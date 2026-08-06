import { redirect } from "next/navigation";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import {
  CustomerInquiryForm,
  CustomerQuoteCard,
  CustomerVendorOfferCard,
} from "@/components/engagement/CustomerEngagementClient";
import {
  getLatestSubmittedQuote,
  listCustomerFacingOffers,
  listInquiriesForCustomerEmail,
  listNotifications,
} from "@/features/engagement/queries";
import { ENGAGEMENT_STATUS_LABELS } from "@/features/engagement/status";
import { getSessionAppUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

export default async function CustomerEngagementPage() {
  const user = await getSessionAppUser();
  if (!user) redirect("/login");
  if (user.roleKey !== "customer") redirect("/access-denied");

  const [inquiries, offers, notifications] = await Promise.all([
    listInquiriesForCustomerEmail(user.email),
    listCustomerFacingOffers(user.email),
    listNotifications("customer", 8),
  ]);

  const quoteCards = await Promise.all(
    inquiries
      .filter((i) =>
        ["quote_sent", "awaiting_signature_deposit", "quote_denied"].includes(
          i.status,
        ),
      )
      .map(async (inquiry) => {
        const quote = await getLatestSubmittedQuote(inquiry.id);
        return quote ? { inquiry, quote } : null;
      }),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        compact
        title="Your event inquiry"
        description="Start a new request, then review MainEvent’s quote when it arrives. Sign and pay the deposit to lock in the event."
      />

      {notifications.length ? (
        <Panel title="Updates">
          <ul className="space-y-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-md bg-[var(--bg)] px-3 py-2">
                <p className="font-medium text-[var(--ink)]">{n.title}</p>
                <p className="text-[var(--muted)]">{n.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="New inquiry">
        <CustomerInquiryForm
          organization={user.organization ?? ""}
          phone={user.phone ?? ""}
        />
      </Panel>

      <Panel title="Your inquiries">
        {inquiries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No inquiries yet — use the form above to start one.
          </p>
        ) : (
          <ul className="space-y-2">
            {inquiries.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{i.event_name}</p>
                  <p className="text-[var(--muted)]">
                    {i.preferred_start}
                    {i.location ? ` · ${i.location}` : ""}
                  </p>
                </div>
                <StatusPill
                  tone={
                    i.status === "terminated"
                      ? "danger"
                      : i.status === "quote_sent" ||
                          i.status === "vendor_offer_sent"
                        ? "warn"
                        : "ok"
                  }
                >
                  {ENGAGEMENT_STATUS_LABELS[i.status]}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {quoteCards.filter(Boolean).length ? (
        <Panel title="Company quotes — accept or deny">
          <div className="space-y-3">
            {quoteCards.map((row) =>
              row ? (
                <CustomerQuoteCard
                  key={row.inquiry.id}
                  inquiry={row.inquiry}
                  quote={row.quote}
                />
              ) : null,
            )}
          </div>
        </Panel>
      ) : null}

      {offers.length ? (
        <Panel title="Vendor packages">
          <div className="space-y-3">
            {offers.map((o) => (
              <CustomerVendorOfferCard key={o.id} offer={o} />
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
