import { CustomerObligationsClient } from "@/components/dashboard/CustomerObligationsClient";
import { getSessionUser } from "@/features/users/session";
import {
  listCustomerFacingContracts,
  resolveCustomerIdForPortalSession,
} from "@/features/involvement/queries";
import {
  buildCustomerPoViews,
  listPerformanceObligationsForContracts,
} from "@/features/performance-obligations";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerObligationsPage() {
  const session = await getSessionUser();
  if (!session || session.roleKey !== "customer") {
    redirect("/access-denied");
  }

  const customerId = await resolveCustomerIdForPortalSession({
    organization: session.organization,
    email: session.email,
  });
  const contracts = customerId
    ? await listCustomerFacingContracts(customerId)
    : [];
  const pos = await listPerformanceObligationsForContracts(
    contracts.map((c) => c.id),
  );
  const views = buildCustomerPoViews(
    pos,
    contracts.map((c) => ({
      id: c.id,
      event_name: c.event_name,
      contract_value: c.contract_value,
    })),
  );

  return <CustomerObligationsClient obligations={views} />;
}
