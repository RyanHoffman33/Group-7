export type PoStatus =
  | "draft"
  | "active"
  | "awaiting_approval"
  | "completed"
  | "cancelled";

export type ContractPerformanceObligation = {
  id: string;
  contract_id: string;
  seq: number;
  title: string;
  description: string | null;
  completion_definition: string;
  amount: number;
  status: PoStatus;
  installment_deposit_id: string | null;
  invoice_id: string | null;
  recognition_evidence_id: string | null;
  ready_for_approval_at: string | null;
  ready_for_approval_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  recognized_at: string | null;
  recognized_amount: number | null;
  created_at: string;
  updated_at: string;
};

export type PoApproval = {
  id: string;
  performance_obligation_id: string;
  contract_id: string;
  approved_by: string;
  approved_at: string;
  confirmation_text: string | null;
  is_final_po: boolean;
  installment_amount: number;
  installment_for_po_id: string | null;
  installment_deposit_id: string | null;
  recognized_amount: number;
  recognition_evidence_id: string | null;
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
};

export type ContractPoSummary = {
  contract_id: string;
  customer_id: string;
  event_name: string;
  contract_value: number;
  po_allocated_total: number;
  allocation_variance: number;
  po_count: number;
  po_completed_count: number;
  recognized_from_pos: number;
  remaining_po_amount: number;
};

export type PoDraftInput = {
  title: string;
  description?: string;
  completion_definition: string;
  amount: number;
};

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft: "Draft",
  active: "Active",
  awaiting_approval: "Awaiting customer approval",
  completed: "Completed & recognized",
  cancelled: "Cancelled",
};

export function isPoStatus(v: string): v is PoStatus {
  return (
    v === "draft" ||
    v === "active" ||
    v === "awaiting_approval" ||
    v === "completed" ||
    v === "cancelled"
  );
}

/** Allocation must match contract value within $0.01 for lock-in. */
export function allocationReconciles(
  allocated: number,
  contractValue: number,
  tolerance = 0.01,
): boolean {
  return Math.abs(allocated - contractValue) <= tolerance;
}
