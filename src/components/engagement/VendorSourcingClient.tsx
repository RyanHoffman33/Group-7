"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/features/billing/aging";
import { Panel, StatusPill } from "@/components/billing/ui";
import {
  MarkupOfferForm,
  SourcingRfqForm,
} from "@/components/engagement/InternalEngagementClient";
import {
  sendMarkedUpVendorOfferAction,
  sendVendorRfqAction,
} from "@/features/engagement/actions";
import type {
  CustomerVendorQuoteOffer,
  EngagementInquiry,
  VendorQuote,
  VendorRfq,
  VendorRow,
} from "@/features/engagement/types";
import { ENGAGEMENT_STATUS_LABELS } from "@/features/engagement/status";

type Tab = "vendors" | "quotes";

export function VendorSourcingClient({
  inquiries,
  vendors,
  rfqsByInquiry,
  quotesByInquiry,
  offersByInquiry,
}: {
  inquiries: EngagementInquiry[];
  vendors: VendorRow[];
  rfqsByInquiry: Record<string, VendorRfq[]>;
  quotesByInquiry: Record<string, VendorQuote[]>;
  offersByInquiry: Record<string, CustomerVendorQuoteOffer[]>;
}) {
  const [tab, setTab] = useState<Tab>("vendors");
  const [selectedId, setSelectedId] = useState(inquiries[0]?.id ?? "");
  const selected = useMemo(
    () => inquiries.find((i) => i.id === selectedId) ?? inquiries[0],
    [inquiries, selectedId],
  );

  if (!selected) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No engagements are ready for vendor sourcing yet. Accept a company quote
        first.
      </p>
    );
  }

  const rfqs = rfqsByInquiry[selected.id] ?? [];
  const quotes = quotesByInquiry[selected.id] ?? [];
  const offers = offersByInquiry[selected.id] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {inquiries.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setSelectedId(i.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              i.id === selected.id
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-[var(--surface)]"
            }`}
          >
            {i.event_name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="accent">
          {ENGAGEMENT_STATUS_LABELS[selected.status]}
        </StatusPill>
        <div className="ml-auto flex gap-1 rounded-md border border-[var(--line)] p-0.5">
          <button
            type="button"
            onClick={() => setTab("vendors")}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === "vendors" ? "bg-[var(--accent)] text-white" : ""
            }`}
          >
            Vendors / Send inquiries
          </button>
          <button
            type="button"
            onClick={() => setTab("quotes")}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === "quotes" ? "bg-[var(--accent)] text-white" : ""
            }`}
          >
            Vendor quotes received
          </button>
        </div>
      </div>

      {tab === "vendors" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Vendor directory">
            <ul className="space-y-2 text-sm">
              {vendors.map((v) => (
                <li
                  key={v.id}
                  className="flex justify-between gap-2 rounded-md border border-[var(--line)] px-3 py-2"
                >
                  <span>{v.name}</span>
                  <span className="text-[var(--muted)]">{v.status}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="space-y-3">
            <SourcingRfqForm
              inquiryId={selected.id}
              vendors={vendors}
              onSend={sendVendorRfqAction}
            />
            <Panel title="Sent RFQs">
              {rfqs.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No RFQs yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {rfqs.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-[var(--line)] px-3 py-2"
                    >
                      <p className="font-medium">{r.title}</p>
                      <p className="text-[var(--muted)]">
                        {r.vendor_name} · {r.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Panel title="Incoming vendor quotes">
            {quotes.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No vendor quotes yet. Send RFQs from the Vendors tab.
              </p>
            ) : (
              <div className="space-y-4">
                {quotes.map((q) => (
                  <div
                    key={q.id}
                    className="grid gap-3 rounded-md border border-[var(--line)] p-3 lg:grid-cols-2"
                  >
                    <div className="text-sm">
                      <p className="font-medium">
                        {q.vendor_name} — {formatCurrency(q.amount)}
                      </p>
                      <p className="text-[var(--muted)]">{q.rfq_title}</p>
                      {q.notes ? (
                        <p className="mt-1 text-[var(--muted)]">{q.notes}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Internal cost only — customers never see this amount.
                      </p>
                    </div>
                    <MarkupOfferForm
                      inquiryId={selected.id}
                      vendorQuoteId={q.id}
                      vendorAmount={q.amount}
                      vendorName={q.vendor_name}
                      onSend={sendMarkedUpVendorOfferAction}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Offers sent to customer">
            {offers.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">None yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {offers.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap justify-between gap-2 rounded-md border border-[var(--line)] px-3 py-2"
                  >
                    <span>
                      Cost {formatCurrency(o.vendor_cost)} + markup{" "}
                      {o.markup_percent}% → customer{" "}
                      {formatCurrency(o.customer_price)}
                    </span>
                    <StatusPill tone="ok">{o.status}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
