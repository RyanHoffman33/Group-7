/**
 * Work & Performance Tracking types.
 * Assignees / submitters / approvers are work_parties (stub directory),
 * not auth users — future role filters should use party_id / party_type.
 */

export type PartyType = "crew" | "vendor" | "manager" | "client";

export type DeliverablePhase = "planning" | "execution" | "wrapup";

export type DeliverableStatus =
  | "promised"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "waived";

export type AssignmentStatus =
  | "scheduled"
  | "checked_in"
  | "completed"
  | "blocked";

export type ExceptionType =
  | "vendor_noshow"
  | "scope_addition"
  | "problem"
  | "other";

export type ExceptionStatus =
  | "submitted"
  | "pending_approval"
  | "approved"
  | "rejected";

/** Scope label when an exception is engagement-wide (not tied to one PO). */
export const EXCEPTION_SCOPE_CONTRACT = "Exception to contract";

export type TimeMaterialEntryType = "time" | "materials" | "cost";

export type WorkParty = {
  id: string;
  display_name: string;
  party_type: PartyType;
  vendor_org: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
};

export type ContractDeliverable = {
  id: string;
  contract_id: string;
  code: string;
  title: string;
  description: string | null;
  phase: DeliverablePhase;
  location: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: DeliverableStatus;
  sort_order: number;
  created_at: string;
};

export type WorkAssignment = {
  id: string;
  contract_id: string;
  deliverable_id: string;
  assignee_party_id: string;
  title: string;
  instructions: string | null;
  location: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: AssignmentStatus;
  created_at: string;
};

export type WorkCompletion = {
  id: string;
  assignment_id: string;
  performed_by_party_id: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  work_notes: string | null;
  completed_before_approval: boolean;
  created_at: string;
};

export type WorkTimeMaterial = {
  id: string;
  assignment_id: string;
  entry_type: TimeMaterialEntryType;
  description: string;
  quantity: number;
  unit_label: string | null;
  unit_cost: number;
  hours: number | null;
  notes: string | null;
  recorded_by_party_id: string | null;
  created_at: string;
};

export type WorkException = {
  id: string;
  contract_id: string;
  assignment_id: string | null;
  exception_type: ExceptionType;
  description: string;
  submitted_by_party_id: string;
  approver_party_id: string | null;
  status: ExceptionStatus;
  billable_eligible: boolean;
  estimated_amount: number | null;
  resolution_notes: string | null;
  approved_at: string | null;
  created_at: string;
};

export type WorkAttachment = {
  id: string;
  assignment_id: string | null;
  exception_id: string | null;
  file_name: string;
  storage_path: string | null;
  external_url: string | null;
  content_type: string | null;
  uploaded_by_party_id: string | null;
  created_at: string;
};

/** Row from v_work_event_status — risk board. */
export type WorkEventStatus = {
  contract_id: string;
  customer_id: string;
  event_name: string;
  contract_status: string;
  performance_complete: boolean;
  customer_name: string;
  promised_count: number;
  scheduled_count: number;
  completed_count: number;
  outstanding_count: number;
  assignment_total: number;
  assignment_completed: number;
  pending_exceptions: number;
  event_start: string | null;
  event_end: string | null;
  outstanding_pct: number;
  has_contract?: boolean;
  ai_obligation_count?: number;
  manual_obligation_count?: number;
};

export type WorkAssignmentDetail = WorkAssignment & {
  assignee: WorkParty | null;
  deliverable: ContractDeliverable | null;
  event_name: string | null;
  customer_name: string | null;
  completion: WorkCompletion | null;
  time_materials: WorkTimeMaterial[];
  attachments: WorkAttachment[];
  exceptions: WorkException[];
};

export type WorkExceptionRow = WorkException & {
  event_name: string | null;
  submitter_name: string | null;
  approver_name: string | null;
  assignment_title: string | null;
};

export type DocumentScanStatus = "pending" | "scanning" | "scanned" | "failed";

export type WorkContractDocument = {
  id: string;
  contract_id: string;
  title: string;
  file_name: string | null;
  external_url: string | null;
  storage_path: string | null;
  contract_text: string | null;
  mime_type: string | null;
  scan_status: DocumentScanStatus;
  scanned_at: string | null;
  scan_error: string | null;
  raw_ai_json: unknown;
  uploaded_by_party_id: string | null;
  is_primary: boolean;
  created_at: string;
};

export type ObligationStatus =
  | "identified"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "waived";

export type WorkPerformanceObligation = {
  id: string;
  contract_id: string;
  document_id: string | null;
  deliverable_id: string | null;
  obligation_number: number;
  code: string;
  title: string;
  description: string | null;
  phase: DeliverablePhase;
  acceptance_criteria: string | null;
  status: ObligationStatus;
  source: "ai_scan" | "manual" | "seed";
  assignee_party_id: string | null;
  customer_contact_name: string | null;
  customer_contact_email: string | null;
  estimated_labor_hours: number;
  estimated_supply_cost: number;
  ready_for_cost_tracking: boolean;
  ready_for_billing_ref: boolean;
  sort_order: number;
  created_at: string;
};

export type WorkObligationResource = {
  id: string;
  obligation_id: string;
  contract_id: string;
  resource_type: "manpower" | "supply" | "equipment";
  label: string;
  role_or_sku: string | null;
  quantity: number;
  unit: string | null;
  estimated_unit_cost: number;
  notes: string | null;
  export_to_cost: boolean;
  created_at: string;
};

export type ObligationWithResources = WorkPerformanceObligation & {
  resources: WorkObligationResource[];
  assignee_name: string | null;
  labor_cost_estimate: number;
  supply_cost_estimate: number;
  total_cost_estimate: number;
};

/** Cross-module handoff row (v_work_obligation_handoff). */
export type WorkObligationHandoff = {
  obligation_id: string;
  contract_id: string;
  event_name: string;
  customer_id: string;
  customer_name: string;
  obligation_code: string;
  obligation_title: string;
  description: string | null;
  phase: DeliverablePhase;
  status: ObligationStatus;
  source: string;
  estimated_labor_hours: number;
  estimated_supply_cost: number;
  ready_for_cost_tracking: boolean;
  ready_for_billing_ref: boolean;
  deliverable_id: string | null;
  deliverable_status: string | null;
  manpower_line_count: number;
  supply_line_count: number;
  equipment_line_count: number;
  resource_estimated_total: number;
  document_id: string | null;
  document_title: string | null;
  scan_status: string | null;
  created_at: string;
};
