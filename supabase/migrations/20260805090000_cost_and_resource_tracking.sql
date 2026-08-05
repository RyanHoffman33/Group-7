-- Walker — Cost & Resource Tracking
-- Adds vendors stub, per-event budgets, and cost_entries ledger.
-- Does not modify contracts/customers/invoices shapes.
-- GAAP adapter should use cost_entries.id as cost_ref_id with cost_source = 'cost_entries'.

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category = ANY (ARRAY['labor'::text, 'vendor'::text, 'materials'::text, 'travel'::text, 'equipment'::text, 'other'::text])),
  budgeted_amount numeric NOT NULL CHECK (budgeted_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, category)
);

CREATE TABLE IF NOT EXISTS public.cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type = ANY (ARRAY['labor'::text, 'vendor_expense'::text])),
  category text NOT NULL CHECK (category = ANY (ARRAY['labor'::text, 'vendor'::text, 'materials'::text, 'travel'::text, 'equipment'::text, 'other'::text])),
  amount numeric NOT NULL CHECK (amount >= 0),
  hours numeric NULL CHECK (hours IS NULL OR hours > 0),
  rate numeric NULL CHECK (rate IS NULL OR rate >= 0),
  worker_label text NULL,
  vendor_id uuid NULL REFERENCES public.vendors(id),
  vendor_name text NULL,
  invoice_ref text NULL,
  commitment_status text NOT NULL CHECK (commitment_status = ANY (ARRAY['committed'::text, 'actual'::text])),
  approval_status text NOT NULL DEFAULT 'not_required' CHECK (approval_status = ANY (ARRAY['not_required'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text])),
  is_reimbursable boolean NOT NULL DEFAULT false,
  notes text NULL,
  entered_by text NOT NULL DEFAULT 'coordinator',
  entered_at timestamptz NOT NULL DEFAULT now(),
  incurred_date date NOT NULL DEFAULT CURRENT_DATE,
  flag_late_entry boolean NOT NULL DEFAULT false,
  flag_duplicate_invoice boolean NOT NULL DEFAULT false,
  flag_over_committed boolean NOT NULL DEFAULT false,
  flag_after_billing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_entries_contract_idx ON public.cost_entries (contract_id);
CREATE INDEX IF NOT EXISTS cost_entries_approval_idx ON public.cost_entries (approval_status);
CREATE INDEX IF NOT EXISTS cost_entries_category_idx ON public.cost_entries (category);
CREATE INDEX IF NOT EXISTS cost_budgets_contract_idx ON public.cost_budgets (contract_id);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendors_demo_all ON public.vendors;
CREATE POLICY vendors_demo_all ON public.vendors FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS cost_budgets_demo_all ON public.cost_budgets;
CREATE POLICY cost_budgets_demo_all ON public.cost_budgets FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS cost_entries_demo_all ON public.cost_entries;
CREATE POLICY cost_entries_demo_all ON public.cost_entries FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.vendors TO anon, authenticated;
GRANT ALL ON public.cost_budgets TO anon, authenticated;
GRANT ALL ON public.cost_entries TO anon, authenticated;
