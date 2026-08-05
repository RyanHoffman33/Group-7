import { listPendingApprovals } from "@/features/contracts/queries";
import { ApprovalQueueClient } from "@/components/contracts/ApprovalQueueClient";
import { PageHeader, Panel } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const rows = await listPendingApprovals();

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Project manager queue. Approval locks commercial terms; it does not recognize revenue or collect deposits."
      />
      <Panel>
        <ApprovalQueueClient rows={rows} />
      </Panel>
    </div>
  );
}
