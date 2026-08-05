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
