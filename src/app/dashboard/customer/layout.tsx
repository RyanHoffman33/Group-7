import { redirect } from "next/navigation";
import { CustomerPortalProvider } from "@/components/dashboard/CustomerPortalContext";
import { CustomerPortalShell } from "@/components/dashboard/CustomerPortalShell";
import { getSessionUser } from "@/features/users/session";
import {
  listApprovalItemsForCustomerContracts,
  listCustomerFacingContracts,
  resolveCustomerIdForOrganization,
} from "@/features/involvement/queries";

export const dynamic = "force-dynamic";

export default async function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.roleKey !== "customer") {
    redirect("/access-denied?from=/dashboard/customer");
  }

  const customerId = await resolveCustomerIdForOrganization(
    session.organization,
  );
  const contracts = customerId
    ? await listCustomerFacingContracts(customerId)
    : [];
  // Strict scope: only this customer's contract IDs
  const contractIds = contracts.map((c) => c.id);
  const approvals = await listApprovalItemsForCustomerContracts(contractIds);

  return (
    <CustomerPortalProvider
      fullName={session.fullName}
      organization={session.organization}
      contracts={contracts}
      approvals={approvals}
    >
      <CustomerPortalShell>{children}</CustomerPortalShell>
    </CustomerPortalProvider>
  );
}
