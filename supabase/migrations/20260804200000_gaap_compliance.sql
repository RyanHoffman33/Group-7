-- GAAP Compliance foundation (ACCY628)
-- Applied remotely as gaap_compliance_foundation.
-- Stable view names are teammate integration contracts — do not rename.

CREATE TABLE IF NOT EXISTS public.gaap_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  asc_reference text NOT NULL,
  mainevent_rule text NOT NULL,
  evidence_required text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recognition_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  evidence_type text NOT NULL CHECK (
    evidence_type = ANY (ARRAY[
      'customer_approval'::text,
      'event_completion'::text,
      'milestone_signoff'::text,
      'delivery_acceptance'::text,
      'time_sheet'::text,
      'other'::text
    ])
  ),
  evidence_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  supporting_ref text,
  created_by text DEFAULT 'billing-user',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_modifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  mod_number text NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  price_change numeric(14,2) NOT NULL DEFAULT 0,
  prior_contract_value numeric(14,2),
  scope_change_notes text,
  accounting_treatment text NOT NULL DEFAULT 'prospective'
    CHECK (accounting_treatment = ANY (ARRAY['prospective'::text, 'cumulative_catchup'::text])),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'applied'::text])),
  approved_by text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, mod_number)
);

CREATE TABLE IF NOT EXISTS public.cost_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_ref_id uuid NOT NULL,
  cost_source text NOT NULL DEFAULT 'billable_costs',
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  classification text NOT NULL CHECK (
    classification = ANY (ARRAY[
      'direct_event_cogs'::text,
      'reimbursable_passthrough'::text,
      'overhead'::text,
      'selling'::text,
      'capitalizable'::text
    ])
  ),
  period date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recognition_evidence_contract_idx
  ON public.recognition_evidence (contract_id);
CREATE INDEX IF NOT EXISTS recognition_evidence_invoice_idx
  ON public.recognition_evidence (invoice_id);
CREATE INDEX IF NOT EXISTS contract_modifications_contract_idx
  ON public.contract_modifications (contract_id);
CREATE INDEX IF NOT EXISTS cost_classifications_contract_idx
  ON public.cost_classifications (contract_id);

ALTER TABLE public.gaap_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gaap_policies_demo_all ON public.gaap_policies;
CREATE POLICY gaap_policies_demo_all ON public.gaap_policies
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS recognition_evidence_demo_all ON public.recognition_evidence;
CREATE POLICY recognition_evidence_demo_all ON public.recognition_evidence
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS contract_modifications_demo_all ON public.contract_modifications;
CREATE POLICY contract_modifications_demo_all ON public.contract_modifications
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cost_classifications_demo_all ON public.cost_classifications;
CREATE POLICY cost_classifications_demo_all ON public.cost_classifications
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW public.v_contract_asset AS
WITH billed AS (
  SELECT contract_id, COALESCE(sum(total), 0)::numeric AS billed_total
  FROM public.invoices
  WHERE status <> ALL (ARRAY['void'::text, 'canceled'::text, 'draft'::text])
  GROUP BY contract_id
),
milestone_earned AS (
  SELECT contract_id, COALESCE(sum(amount), 0)::numeric AS milestone_earned
  FROM public.contract_milestones
  WHERE completed = true
  GROUP BY contract_id
)
SELECT
  c.id AS contract_id,
  c.customer_id,
  c.event_name,
  c.contract_value,
  c.progress_percent,
  c.performance_complete,
  round(
    CASE
      WHEN c.performance_complete THEN c.contract_value
      WHEN COALESCE(me.milestone_earned, 0) > 0 THEN LEAST(c.contract_value, me.milestone_earned)
      ELSE c.contract_value * (COALESCE(c.progress_percent, 0) / 100.0)
    END,
    2
  ) AS earned_to_date,
  COALESCE(b.billed_total, 0)::numeric AS billed_to_date,
  GREATEST(
    0::numeric,
    round(
      CASE
        WHEN c.performance_complete THEN c.contract_value
        WHEN COALESCE(me.milestone_earned, 0) > 0 THEN LEAST(c.contract_value, me.milestone_earned)
        ELSE c.contract_value * (COALESCE(c.progress_percent, 0) / 100.0)
      END,
      2
    ) - COALESCE(b.billed_total, 0)
  ) AS contract_asset
FROM public.contracts c
LEFT JOIN billed b ON b.contract_id = c.id
LEFT JOIN milestone_earned me ON me.contract_id = c.id;

CREATE OR REPLACE VIEW public.v_contract_liability AS
SELECT
  c.id AS contract_id,
  c.customer_id,
  c.event_name,
  COALESCE((
    SELECT sum(d.amount) FROM public.deposits d
    WHERE d.contract_id = c.id AND d.status = 'unearned'
  ), 0)::numeric AS unearned_deposits,
  COALESCE((
    SELECT sum(
      i.total - COALESCE((
        SELECT sum(pa.amount) FROM public.payment_applications pa WHERE pa.invoice_id = i.id
      ), 0)
    )
    FROM public.invoices i
    WHERE i.contract_id = c.id
      AND i.status = ANY (ARRAY['unpaid'::text, 'partially_paid'::text, 'disputed'::text, 'issued'::text])
      AND i.recognition_status = 'deferred'
  ), 0)::numeric AS deferred_billed_outstanding,
  (
    COALESCE((
      SELECT sum(d.amount) FROM public.deposits d
      WHERE d.contract_id = c.id AND d.status = 'unearned'
    ), 0)
    + COALESCE((
      SELECT sum(
        i.total - COALESCE((
          SELECT sum(pa.amount) FROM public.payment_applications pa WHERE pa.invoice_id = i.id
        ), 0)
      )
      FROM public.invoices i
      WHERE i.contract_id = c.id
        AND i.status = ANY (ARRAY['unpaid'::text, 'partially_paid'::text, 'disputed'::text, 'issued'::text])
        AND i.recognition_status = 'deferred'
    ), 0)
  )::numeric AS total_contract_liability
FROM public.contracts c;

CREATE OR REPLACE VIEW public.v_gaap_contract_position AS
SELECT
  c.id AS contract_id,
  c.customer_id,
  cu.name AS customer_name,
  c.event_name,
  c.contract_value,
  c.billing_method,
  c.performance_complete,
  c.progress_percent,
  COALESCE(a.billed_to_date, 0)::numeric AS billed_to_date,
  COALESCE(a.earned_to_date, 0)::numeric AS earned_to_date,
  COALESCE(a.contract_asset, 0)::numeric AS contract_asset,
  COALESCE(l.unearned_deposits, 0)::numeric AS unearned_deposits,
  COALESCE(l.deferred_billed_outstanding, 0)::numeric AS deferred_billed_outstanding,
  COALESCE(l.total_contract_liability, 0)::numeric AS total_contract_liability,
  COALESCE((
    SELECT sum(i.total) FROM public.invoices i
    WHERE i.contract_id = c.id
      AND i.recognition_status = 'recognized'
      AND i.status <> ALL (ARRAY['void'::text, 'canceled'::text, 'draft'::text])
  ), 0)::numeric AS recognized_revenue_billed,
  COALESCE((
    SELECT sum(
      i.total - COALESCE((
        SELECT sum(pa.amount) FROM public.payment_applications pa WHERE pa.invoice_id = i.id
      ), 0)
    )
    FROM public.invoices i
    WHERE i.contract_id = c.id
      AND i.status = ANY (ARRAY['unpaid'::text, 'partially_paid'::text, 'disputed'::text, 'issued'::text])
  ), 0)::numeric AS open_ar
FROM public.contracts c
JOIN public.customers cu ON cu.id = c.customer_id
LEFT JOIN public.v_contract_asset a ON a.contract_id = c.id
LEFT JOIN public.v_contract_liability l ON l.contract_id = c.id;

CREATE OR REPLACE VIEW public.v_profitability_inputs AS
SELECT
  c.id AS contract_id,
  c.customer_id,
  c.event_name,
  COALESCE((
    SELECT sum(i.total) FROM public.invoices i
    WHERE i.contract_id = c.id
      AND i.recognition_status = 'recognized'
      AND i.status <> ALL (ARRAY['void'::text, 'canceled'::text, 'draft'::text])
  ), 0)::numeric AS recognized_revenue,
  COALESCE((
    SELECT sum(cc.amount) FROM public.cost_classifications cc
    WHERE cc.contract_id = c.id AND cc.classification = 'direct_event_cogs'
  ), 0)::numeric AS direct_event_cogs,
  COALESCE((
    SELECT sum(cc.amount) FROM public.cost_classifications cc
    WHERE cc.contract_id = c.id AND cc.classification = 'reimbursable_passthrough'
  ), 0)::numeric AS reimbursable_passthrough,
  COALESCE((
    SELECT sum(cc.amount) FROM public.cost_classifications cc
    WHERE cc.contract_id = c.id
      AND cc.classification = ANY (ARRAY['overhead'::text, 'selling'::text])
  ), 0)::numeric AS period_expenses
FROM public.contracts c;

GRANT SELECT ON public.v_contract_asset TO anon, authenticated;
GRANT SELECT ON public.v_contract_liability TO anon, authenticated;
GRANT SELECT ON public.v_gaap_contract_position TO anon, authenticated;
GRANT SELECT ON public.v_profitability_inputs TO anon, authenticated;
GRANT ALL ON public.gaap_policies TO anon, authenticated;
GRANT ALL ON public.recognition_evidence TO anon, authenticated;
GRANT ALL ON public.contract_modifications TO anon, authenticated;
GRANT ALL ON public.cost_classifications TO anon, authenticated;
