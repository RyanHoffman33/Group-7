import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/billing/ui";
import { VendorSourcingClient } from "@/components/engagement/VendorSourcingClient";
import { roleHasPermission } from "@/features/access/matrix";
import {
  listOffersForInquiry,
  listRfqsForInquiry,
  listSourcingInquiries,
  listVendorQuotesForInquiry,
  listVendors,
} from "@/features/engagement/queries";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

export default async function EngagementSourcingPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (
    !roleHasPermission(session.roleKey, "contracts.write") &&
    session.roleKey !== "executive" &&
    session.roleKey !== "project_manager" &&
    session.roleKey !== "system_admin"
  ) {
    redirect("/access-denied");
  }

  const [inquiries, vendors] = await Promise.all([
    listSourcingInquiries(),
    listVendors(),
  ]);

  const rfqsByInquiry: Record<string, Awaited<ReturnType<typeof listRfqsForInquiry>>> =
    {};
  const quotesByInquiry: Record<
    string,
    Awaited<ReturnType<typeof listVendorQuotesForInquiry>>
  > = {};
  const offersByInquiry: Record<
    string,
    Awaited<ReturnType<typeof listOffersForInquiry>>
  > = {};

  await Promise.all(
    inquiries.map(async (inq) => {
      const [rfqs, quotes, offers] = await Promise.all([
        listRfqsForInquiry(inq.id),
        listVendorQuotesForInquiry(inq.id),
        listOffersForInquiry(inq.id),
      ]);
      rfqsByInquiry[inq.id] = rfqs;
      quotesByInquiry[inq.id] = quotes;
      offersByInquiry[inq.id] = offers;
    }),
  );

  return (
    <div>
      <PageHeader
        title="Vendor Sourcing"
        description="Browse vendors, send RFQs, mark up received quotes, and pass customer-facing prices to the portal."
      />
      <p className="mb-4 text-sm">
        <Link
          href="/engagement/approvals"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          ← Inquiry approval queue
        </Link>
      </p>
      <VendorSourcingClient
        inquiries={inquiries}
        vendors={vendors}
        rfqsByInquiry={rfqsByInquiry}
        quotesByInquiry={quotesByInquiry}
        offersByInquiry={offersByInquiry}
      />
    </div>
  );
}
