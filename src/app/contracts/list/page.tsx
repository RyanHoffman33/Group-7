import Link from "next/link";
import { listContractsDetailed } from "@/features/contracts/queries";
import { ContractsTable } from "@/components/contracts/ContractsTable";
import { PageHeader, Panel } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function ContractsListPage() {
  const rows = await listContractsDetailed();

  return (
    <div>
      <PageHeader
        title="All Contracts"
        description="Searchable register of MainEvent engagements. One contract equals one event."
        actions={
          <Link
            href="/contracts/new"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Create contract
          </Link>
        }
      />
      <Panel>
        <ContractsTable rows={rows} />
      </Panel>
    </div>
  );
}
