import { notFound } from "next/navigation";
import {
  getContract,
  listApprovals,
  listAuditEvents,
  listChangeOrders,
  listDeliverables,
  listDocuments,
  listLineItems,
  listMilestones,
} from "@/features/contracts/queries";
import { ContractDetailClient } from "@/components/contracts/ContractDetailClient";
import { PageHeader } from "@/components/billing/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) notFound();

  const [
    lines,
    deliverables,
    milestones,
    approvals,
    documents,
    audit,
    changeOrders,
  ] = await Promise.all([
    listLineItems(id),
    listDeliverables(id),
    listMilestones(id),
    listApprovals(id),
    listDocuments(id),
    listAuditEvents(id),
    listChangeOrders(id),
  ]);

  return (
    <div>
      <PageHeader
        title="Contract workspace"
        description="Internal engagement record — billing cash and recognition remain in Billing & Compliance."
        actions={
          <Link
            href="/contracts/list"
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold"
          >
            Back to list
          </Link>
        }
      />
      <ContractDetailClient
        contract={contract}
        lines={lines}
        deliverables={deliverables}
        milestones={milestones}
        approvals={approvals}
        documents={documents}
        audit={audit}
        changeOrders={changeOrders}
      />
    </div>
  );
}
