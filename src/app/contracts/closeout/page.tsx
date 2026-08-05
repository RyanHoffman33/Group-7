import { listCloseoutCandidates } from "@/features/contracts/queries";
import { CloseoutClient } from "@/components/contracts/CloseoutClient";
import { PageHeader, Panel } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function CloseoutPage() {
  const rows = await listCloseoutCandidates();

  return (
    <div>
      <PageHeader
        title="Contract Closeout"
        description="Verify event completion, A/R, change orders, disputes, and documentation before closing. Closeout does not recognize revenue."
      />
      <Panel>
        <CloseoutClient rows={rows} />
      </Panel>
    </div>
  );
}
