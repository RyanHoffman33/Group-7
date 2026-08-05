import { PageHeader, Panel } from "@/components/billing/ui";
import { TimeEntryForm } from "@/components/costs/Actions";
import { listContractsForCosts } from "@/features/costs/queries";

export const dynamic = "force-dynamic";

export default async function TimeEntryPage() {
  const contracts = await listContractsForCosts();

  return (
    <div>
      <PageHeader
        title="Time entry"
        description="Log hours against a specific event."
      />
      <Panel title="Log hours">
        <TimeEntryForm
          contracts={contracts.map((c) => ({
            id: c.id,
            event_name: c.event_name,
          }))}
        />
      </Panel>
    </div>
  );
}
