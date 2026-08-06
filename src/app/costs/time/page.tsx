import { PageHeader, Panel } from "@/components/billing/ui";
import { TimeEntryForm } from "@/components/costs/Actions";
import { DEFAULT_LABOR_RATE } from "@/features/costs/config";
import { listContractsForCosts } from "@/features/costs/queries";
import { getSessionUser } from "@/features/users/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TimeEntryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const contracts = await listContractsForCosts();

  return (
    <div>
      <PageHeader
        title="Time entry"
        description="Log hours against a specific event using your signed-in profile and approved rate."
      />
      <Panel title="Log hours">
        <TimeEntryForm
          contracts={contracts.map((c) => ({
            id: c.id,
            event_name: c.event_name,
          }))}
          teamMemberName={session.fullName}
          approvedHourlyRate={DEFAULT_LABOR_RATE}
        />
      </Panel>
    </div>
  );
}
