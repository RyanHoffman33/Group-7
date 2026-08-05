import { listCustomersForContracts } from "@/features/contracts/queries";
import { CreateContractWizard } from "@/components/contracts/CreateContractWizard";
import { PageHeader } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function NewContractPage() {
  const customers = await listCustomersForContracts();

  return (
    <div>
      <PageHeader
        title="Create Contract"
        description="Multi-step engagement setup. Reuses customer master records; one contract maps to one event."
      />
      {customers.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No customers in the system yet. Billing seed customers are required.
        </p>
      ) : (
        <CreateContractWizard
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}
