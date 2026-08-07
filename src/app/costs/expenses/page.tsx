import { PageHeader, Panel } from "@/components/billing/ui";
import { ExpenseEntryForm } from "@/components/costs/Actions";
import { listVendors } from "@/features/costs/adapters/vendors";
import { listContractsForCosts } from "@/features/costs/queries";

export const dynamic = "force-dynamic";

export default async function ExpenseEntryPage() {
  const [contracts, vendors] = await Promise.all([
    listContractsForCosts(),
    listVendors(),
  ]);

  return (
    <div>
      <PageHeader
        title="Vendor Expense Entry"
        description="Log contractor/subcontractor, materials, equipment, vendor charges, advertising, travel, reimbursable, payroll-related, replacement parts, allocated, and other direct costs — each tied to a contract/event."
      />
      <div className="mx-auto max-w-xl">
        <Panel title="Log expense">
          <ExpenseEntryForm
            contracts={contracts.map((c) => ({
              id: c.id,
              event_name: c.event_name,
            }))}
            vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
          />
        </Panel>
      </div>
    </div>
  );
}
