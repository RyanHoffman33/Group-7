-- Billing & A/R foundation (ACCY628)
-- Applied to project eslwjydxevrdgeiqkwtq as migration billing_ar_foundation.
-- Keep in sync when changing schema; apply via Supabase MCP apply_migration or CLI.

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  billing_email text NOT NULL,
  payment_terms_days integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  event_name text NOT NULL,
  contract_value numeric(14,2) NOT NULL CHECK (contract_value >= 0),
  deposit_required boolean NOT NULL DEFAULT true,
  deposit_percent numeric(5,2) NOT NULL DEFAULT 30 CHECK (deposit_percent >= 0 AND deposit_percent <= 100),
  status text NOT NULL DEFAULT 'approved',
  performance_complete boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  invoice_number text NOT NULL UNIQUE,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  tax numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total numeric(14,2) NOT NULL CHECK (total >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','partially_paid','paid','void')),
  recognition_status text NOT NULL DEFAULT 'deferred' CHECK (recognition_status IN ('deferred','recognized')),
  milestone_key text,
  voided_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_open_milestone_uidx
  ON public.invoices (contract_id, milestone_key)
  WHERE milestone_key IS NOT NULL AND status <> 'void';

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  performance_obligation_ref text
);

CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'unearned' CHECK (status IN ('unearned','applied','refunded')),
  applied_to_invoice_id uuid REFERENCES public.invoices(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'ach',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ar_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id),
  entry_type text NOT NULL,
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ar_bucket_state (
  invoice_id uuid PRIMARY KEY REFERENCES public.invoices(id) ON DELETE CASCADE,
  current_bucket text NOT NULL CHECK (current_bucket IN ('current','1-30','31-60','61-90','90+')),
  outstanding_amount numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  from_bucket text NOT NULL,
  to_bucket text NOT NULL,
  outstanding_amount numeric(14,2) NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.customer_payment_stats (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  avg_days_to_pay numeric(10,2),
  on_time_rate numeric(5,4),
  sample_size integer NOT NULL DEFAULT 0,
  bucket_survival jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.v_ar_outstanding
WITH (security_invoker = true) AS
SELECT
  i.id AS invoice_id,
  i.invoice_number,
  i.customer_id,
  i.contract_id,
  i.due_date,
  i.status,
  i.recognition_status,
  i.total,
  COALESCE(SUM(pa.amount), 0) AS amount_paid,
  i.total - COALESCE(SUM(pa.amount), 0) AS outstanding
FROM public.invoices i
LEFT JOIN public.payment_applications pa ON pa.invoice_id = i.id
WHERE i.status IN ('issued', 'partially_paid')
GROUP BY i.id
HAVING i.total - COALESCE(SUM(pa.amount), 0) > 0;

CREATE OR REPLACE VIEW public.v_unearned_deposits
WITH (security_invoker = true) AS
SELECT d.*, c.event_name, cu.name AS customer_name
FROM public.deposits d
JOIN public.contracts c ON c.id = d.contract_id
JOIN public.customers cu ON cu.id = d.customer_id
WHERE d.status = 'unearned';

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_bucket_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_stats ENABLE ROW LEVEL SECURITY;
