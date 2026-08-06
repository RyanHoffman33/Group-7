import { CustomerActionsPage } from "@/components/dashboard/CustomerActionsPage";
import { CustomerQuotesPanel } from "@/components/dashboard/CustomerQuotesPanel";
import { listQuotesForCustomer } from "@/features/requests/actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const quotes = await listQuotesForCustomer();
  return (
    <div className="flex flex-col gap-4">
      <CustomerQuotesPanel quotes={quotes} />
      <CustomerActionsPage />
    </div>
  );
}
