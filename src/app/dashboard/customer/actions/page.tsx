import { CustomerActionsPage } from "@/components/dashboard/CustomerActionsPage";
import { CustomerContractProposalsPanel } from "@/components/dashboard/CustomerContractProposalsPanel";
import { CustomerQuotesPanel } from "@/components/dashboard/CustomerQuotesPanel";
import { listQuotesForCustomer } from "@/features/requests/actions";
import { getSessionUser } from "@/features/users/session";
import {
  listCustomerContractProposals,
  resolveCustomerIdForPortalSession,
} from "@/features/involvement/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSessionUser();
  const quotes = await listQuotesForCustomer();
  const customerId = session
    ? await resolveCustomerIdForPortalSession({
        organization: session.organization,
        email: session.email,
      })
    : null;
  const proposals = customerId
    ? await listCustomerContractProposals(customerId)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <CustomerContractProposalsPanel proposals={proposals} />
      <CustomerQuotesPanel quotes={quotes} />
      <CustomerActionsPage />
    </div>
  );
}
