import { notFound } from "next/navigation";
import {
  getContract,
  listApprovals,
  listContractActivity,
  listChangeOrders,
  listContractDeposits,
  listContractInvoices,
  listContractPayments,
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

  const contractId = contract.id;

  const [
    lines,
    deliverables,
    milestones,
    approvals,
    documents,
    audit,
    changeOrders,
    invoices,
    payments,
    deposits,
  ] = await Promise.all([
    listLineItems(contractId),
    listDeliverables(contractId),
    listMilestones(contractId),
    listApprovals(contractId),
    listDocuments(contractId),
    listContractActivity(contractId),
    listChangeOrders(contractId),
    listContractInvoices(contractId),
    listContractPayments(contractId),
    listContractDeposits(contractId),
  ]);

  return (
    <div>
      <PageHeader
        title="Contract workspace"
        description="Engagement commercial position with billing rollups — invoices, payments, and deposits for this contract."
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
        invoices={invoices}
        payments={payments}
        deposits={deposits}
      />
    </div>
  );
}
