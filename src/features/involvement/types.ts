import type { CheckpointType, InvolvementModel } from "./checkpoints";

export type { CheckpointType, InvolvementModel };

export type ApprovalItemStatus =
  | "draft"
  | "pending"
  | "approved"
  | "changes_requested"
  | "superseded";

export type ApprovalDecisionKind = "approved" | "changes_requested";

export type CustomerApprovalItem = {
  id: string;
  contract_id: string;
  checkpoint_type: CheckpointType | string;
  title: string;
  item_key: string;
  version: number;
  supporting_info: string | null;
  due_date: string | null;
  status: ApprovalItemStatus | string;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerApprovalDecision = {
  id: string;
  approval_item_id: string;
  decision: ApprovalDecisionKind | string;
  comments: string | null;
  customer_contact: string;
  decided_at: string;
  approved_version: number;
  created_at: string;
};

export type ContractInvolvementCheckpoint = {
  id: string;
  contract_id: string;
  checkpoint_type: CheckpointType | string;
  required: boolean;
  created_at: string;
};

/** Customer-safe contract fields only (no costs, memos, profitability). */
export type CustomerFacingContract = {
  id: string;
  contract_number: string;
  event_name: string;
  event_type: string | null;
  event_start: string | null;
  event_end: string | null;
  venue_name: string | null;
  venue_city: string | null;
  guest_count: number | null;
  status: string;
  project_manager_label: string;
  involvement_model: InvolvementModel | string;
  contract_value: number;
  notes: string | null;
};

export type ApprovalItemWithMeta = CustomerApprovalItem & {
  contract_number: string;
  event_name: string;
  decisions: CustomerApprovalDecision[];
};
