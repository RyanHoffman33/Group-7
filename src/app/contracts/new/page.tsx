import { listCustomersMerged } from "@/features/contracts/customers-demo";
import { CreateContractWizard } from "@/components/contracts/CreateContractWizard";
import { PageHeader } from "@/components/billing/ui";
import { CreateCustomerForm } from "@/components/contracts/CreateCustomerForm";

export const dynamic = "force-dynamic";

export default async function NewContractPage() {
  const customers = await listCustomersMerged();

  return (
    <div>
      <PageHeader
        title="Create Contract"
        description="Guided setup for one customer event: scope, pricing, payments, obligations, and approvals. Create a customer above if they’re not listed yet."
      />
      <div className="mb-6">
        <CreateCustomerForm />
      </div>
      {customers.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No customers yet. Create one above to start a contract.
        </p>
      ) : (
        <CreateContractWizard
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}
