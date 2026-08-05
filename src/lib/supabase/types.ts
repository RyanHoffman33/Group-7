export type DepositStatus = "unearned" | "applied" | "refunded";

export type InvoiceStatus =
  | "draft"
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "disputed"
  | "canceled"
  | "void";

export type RecognitionStatus = "deferred" | "recognized";
export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export type BillingMethod =
  | "fixed_price"
  | "hourly"
  | "time_and_materials"
  | "milestone"
  | "progress"
  | "retainer"
  | "deposit"
  | "recurring"
  | "per_service"
  | "placement_fee"
  | "reimbursable"
  | "cost_plus";

export type Customer = {
  id: string;
  name: string;
  billing_email: string;
  payment_terms_days: number;
  status: string;
  created_at: string;
};

export type Contract = {
  id: string;
  customer_id: string;
  event_name: string;
  contract_value: number;
  deposit_required: boolean;
  deposit_percent: number;
  status: string;
  performance_complete: boolean;
  approved_at: string | null;
  created_at: string;
  billing_method: BillingMethod;
  hourly_rate: number;
  markup_percent: number;
  retainer_amount: number;
  recurring_amount: number;
  placement_fee_percent: number;
  progress_percent: number;
  per_service_rate: number;
  /** Contracts foundation (optional until all readers select *) */
  contract_number?: string;
  original_contract_value?: number;
  change_order_value_total?: number;
  project_manager_label?: string;
  project_manager_party_id?: string | null;
  event_type?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  venue_name?: string | null;
  venue_city?: string | null;
  guest_count?: number | null;
  minimum_deposit_amount?: number | null;
  requires_deposit_before_work?: boolean;
  approved_by?: string | null;
  currency?: string;
};

export type Deposit = {
  id: string;
  contract_id: string;
  customer_id: string;
  amount: number;
  received_at: string;
  status: DepositStatus;
  applied_to_invoice_id: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  contract_id: string;
  customer_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  recognition_status: RecognitionStatus;
  billing_method: BillingMethod | null;
  milestone_key: string | null;
  status_note: string | null;
  disputed_at: string | null;
  canceled_at: string | null;
  voided_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type InvoiceLine = {
  id: string;
  invoice_id: string;
  description: string;
  amount: number;
  performance_obligation_ref: string | null;
  line_type: string;
  quantity: number;
  unit_rate: number;
  hours: number;
  cost_basis: number;
  markup_percent: number;
};

export type Payment = {
  id: string;
  customer_id: string;
  amount: number;
  paid_at: string;
  method: string;
  reference: string | null;
  created_at: string;
};

export type PaymentApplication = {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount: number;
  created_at: string;
};

export type ArLedgerEntry = {
  id: string;
  invoice_id: string | null;
  entry_type: string;
  debit: number;
  credit: number;
  memo: string | null;
  created_at: string;
};

export type BillingAlert = {
  id: string;
  invoice_id: string;
  customer_id: string;
  from_bucket: AgingBucket;
  to_bucket: AgingBucket;
  outstanding_amount: number;
  channel: string;
  created_at: string;
  acknowledged_at: string | null;
};

export type CustomerPaymentStats = {
  customer_id: string;
  avg_days_to_pay: number | null;
  on_time_rate: number | null;
  sample_size: number;
  bucket_survival: Record<string, number> | null;
  updated_at: string;
};

export type BillableTimeEntry = {
  id: string;
  contract_id: string;
  customer_id: string;
  work_date: string;
  worker_label: string;
  description: string;
  hours: number;
  rate: number;
  billed_invoice_id: string | null;
  created_at: string;
};

export type BillableCost = {
  id: string;
  contract_id: string;
  customer_id: string;
  incurred_date: string;
  description: string;
  cost_amount: number;
  markup_percent: number;
  is_reimbursable: boolean;
  billed_invoice_id: string | null;
  created_at: string;
};

export type ContractMilestone = {
  id: string;
  contract_id: string;
  milestone_key: string;
  label: string;
  amount: number;
  due_date: string | null;
  completed: boolean;
  billed_invoice_id: string | null;
};

export type BillingSchedule = {
  id: string;
  contract_id: string;
  customer_id: string;
  label: string;
  billing_method: "recurring" | "retainer";
  amount: number;
  cadence: string;
  next_run_date: string;
  auto_draft: boolean;
  active: boolean;
  created_at: string;
};

export type PaymentDraft = {
  id: string;
  schedule_id: string | null;
  invoice_id: string | null;
  customer_id: string;
  amount: number;
  draft_date: string;
  status: "simulated" | "applied" | "failed" | "canceled";
  reference: string | null;
  created_at: string;
};

export type EvidenceType =
  | "customer_approval"
  | "event_completion"
  | "milestone_signoff"
  | "delivery_acceptance"
  | "time_sheet"
  | "other";

export type ModAccountingTreatment = "prospective" | "cumulative_catchup";
export type ModStatus = "draft" | "approved" | "applied";

export type CostClassificationType =
  | "direct_event_cogs"
  | "reimbursable_passthrough"
  | "overhead"
  | "selling"
  | "capitalizable";

export type GaapPolicy = {
  id: string;
  topic: string;
  asc_reference: string;
  mainevent_rule: string;
  evidence_required: string;
  sort_order: number;
  created_at: string;
};

export type RecognitionEvidence = {
  id: string;
  contract_id: string;
  invoice_id: string | null;
  evidence_type: EvidenceType;
  evidence_date: string;
  description: string;
  supporting_ref: string | null;
  created_by: string | null;
  created_at: string;
};

export type ContractModification = {
  id: string;
  contract_id: string;
  mod_number: string;
  effective_date: string;
  description: string;
  price_change: number;
  prior_contract_value: number | null;
  scope_change_notes: string | null;
  accounting_treatment: ModAccountingTreatment;
  status: ModStatus;
  approved_by: string | null;
  applied_at: string | null;
  created_at: string;
};

export type CostClassification = {
  id: string;
  cost_ref_id: string;
  cost_source: string;
  contract_id: string;
  classification: CostClassificationType;
  period: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

export type GaapContractPosition = {
  contract_id: string;
  customer_id: string;
  customer_name: string;
  event_name: string;
  contract_value: number;
  billing_method: BillingMethod | null;
  performance_complete: boolean;
  progress_percent: number;
  billed_to_date: number;
  earned_to_date: number;
  contract_asset: number;
  unearned_deposits: number;
  deferred_billed_outstanding: number;
  total_contract_liability: number;
  recognized_revenue_billed: number;
  open_ar: number;
};

export type ProfitabilityInput = {
  contract_id: string;
  customer_id: string;
  event_name: string;
  recognized_revenue: number;
  direct_event_cogs: number;
  reimbursable_passthrough: number;
  period_expenses: number;
};
