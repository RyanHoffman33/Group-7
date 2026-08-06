-- ASC 606 commercial performance obligations (POs) with customer approval
-- and installment payment gates. New objects / columns only.
-- Project: ACCY628-FINAL-PROJECT (eslwjydxevrdgeiqkwtq)

-- ---------------------------------------------------------------------------
-- 1) Commercial POs on contracts (distinct from operational work_performance_obligations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_performance_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  title text NOT NULL,
  description text,
  completion_definition text NOT NULL DEFAULT '',
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'draft',
  installment_deposit_id uuid REFERENCES public.deposits(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  recognition_evidence_id uuid REFERENCES public.recognition_evidence(id) ON DELETE SET NULL,
  ready_for_approval_at timestamptz,
  ready_for_approval_by text,
  approved_at timestamptz,
  approved_by text,
  recognized_at timestamptz,
  recognized_amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_performance_obligations_seq_check CHECK (seq >= 1),
  CONSTRAINT contract_performance_obligations_status_check CHECK (
    status = ANY (ARRAY[
      'draft'::text,
      'active'::text,
      'awaiting_approval'::text,
      'completed'::text,
      'cancelled'::text
    ])
  ),
  CONSTRAINT contract_performance_obligations_contract_seq_unique
    UNIQUE (contract_id, seq)
);

CREATE INDEX IF NOT EXISTS contract_performance_obligations_contract_idx
  ON public.contract_performance_obligations (contract_id);

CREATE INDEX IF NOT EXISTS contract_performance_obligations_status_idx
  ON public.contract_performance_obligations (status);

-- ---------------------------------------------------------------------------
-- 2) Approval audit trail (who / when / installment / recognition)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_obligation_id uuid NOT NULL
    REFERENCES public.contract_performance_obligations(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  approved_by text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  confirmation_text text,
  is_final_po boolean NOT NULL DEFAULT false,
  installment_amount numeric(14,2) NOT NULL DEFAULT 0,
  installment_for_po_id uuid
    REFERENCES public.contract_performance_obligations(id) ON DELETE SET NULL,
  installment_deposit_id uuid REFERENCES public.deposits(id) ON DELETE SET NULL,
  recognized_amount numeric(14,2) NOT NULL DEFAULT 0,
  recognition_evidence_id uuid REFERENCES public.recognition_evidence(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS po_approvals_po_idx
  ON public.po_approvals (performance_obligation_id);
CREATE INDEX IF NOT EXISTS po_approvals_contract_idx
  ON public.po_approvals (contract_id);
CREATE INDEX IF NOT EXISTS po_approvals_approved_at_idx
  ON public.po_approvals (approved_at DESC);

-- ---------------------------------------------------------------------------
-- 3) Link deposits to the PO installment they prepay
-- ---------------------------------------------------------------------------
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS performance_obligation_id uuid
    REFERENCES public.contract_performance_obligations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deposits_performance_obligation_idx
  ON public.deposits (performance_obligation_id)
  WHERE performance_obligation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) View: PO allocation vs contract value + recognition rollup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_contract_po_summary
WITH (security_invoker = true) AS
SELECT
  c.id AS contract_id,
  c.customer_id,
  c.event_name,
  c.contract_value,
  COALESCE(sum(po.amount), 0)::numeric AS po_allocated_total,
  round(c.contract_value - COALESCE(sum(po.amount), 0), 2) AS allocation_variance,
  count(po.id)::integer AS po_count,
  count(po.id) FILTER (WHERE po.status = 'completed')::integer AS po_completed_count,
  COALESCE(sum(po.amount) FILTER (WHERE po.status = 'completed'), 0)::numeric AS recognized_from_pos,
  COALESCE(sum(po.amount) FILTER (WHERE po.status <> 'completed' AND po.status <> 'cancelled'), 0)::numeric AS remaining_po_amount
FROM public.contracts c
LEFT JOIN public.contract_performance_obligations po
  ON po.contract_id = c.id AND po.status <> 'cancelled'
GROUP BY c.id, c.customer_id, c.event_name, c.contract_value;

-- Extend earned_to_date to include completed commercial POs (ASC 606 Step 5)
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
),
po_earned AS (
  SELECT contract_id, COALESCE(sum(amount), 0)::numeric AS po_earned
  FROM public.contract_performance_obligations
  WHERE status = 'completed'
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
      WHEN COALESCE(pe.po_earned, 0) > 0 THEN LEAST(
        c.contract_value,
        GREATEST(COALESCE(pe.po_earned, 0), COALESCE(me.milestone_earned, 0))
      )
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
        WHEN COALESCE(pe.po_earned, 0) > 0 THEN LEAST(
          c.contract_value,
          GREATEST(COALESCE(pe.po_earned, 0), COALESCE(me.milestone_earned, 0))
        )
        WHEN COALESCE(me.milestone_earned, 0) > 0 THEN LEAST(c.contract_value, me.milestone_earned)
        ELSE c.contract_value * (COALESCE(c.progress_percent, 0) / 100.0)
      END,
      2
    ) - COALESCE(b.billed_total, 0)
  ) AS contract_asset
FROM public.contracts c
LEFT JOIN billed b ON b.contract_id = c.id
LEFT JOIN milestone_earned me ON me.contract_id = c.id
LEFT JOIN po_earned pe ON pe.contract_id = c.id;

-- Refresh dependent position view (same definition as gaap_compliance; depends on v_contract_asset)
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

-- ---------------------------------------------------------------------------
-- 5) RLS (demo-permissive, matching other contract tables)
-- ---------------------------------------------------------------------------
ALTER TABLE public.contract_performance_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_performance_obligations_demo_all
  ON public.contract_performance_obligations;
CREATE POLICY contract_performance_obligations_demo_all
  ON public.contract_performance_obligations
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS po_approvals_demo_all ON public.po_approvals;
CREATE POLICY po_approvals_demo_all
  ON public.po_approvals
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_performance_obligations
  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_approvals
  TO anon, authenticated;
GRANT SELECT ON public.v_contract_po_summary TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Seed: Delta Leadership Conference + Delta Holiday Reception (3+ POs each)
-- ---------------------------------------------------------------------------
-- Leadership Conference $50,000 — PO1 installment already paid (unearned until approval)
INSERT INTO public.contract_performance_obligations (
  id, contract_id, seq, title, description, completion_definition, amount, status,
  ready_for_approval_at, ready_for_approval_by, created_at, updated_at
) VALUES
(
  'a0606001-0001-4000-8000-000000000001',
  '22222222-2222-2222-2222-222222222230',
  1,
  'Event planning & design package',
  'Concept, floor plan, vendor shortlist, and run-of-show draft.',
  'Customer signs off that planning package is complete and ready for production.',
  15000.00,
  'awaiting_approval',
  now() - interval '2 days',
  'Alex Rivera',
  now() - interval '14 days',
  now()
),
(
  'a0606001-0001-4000-8000-000000000002',
  '22222222-2222-2222-2222-222222222230',
  2,
  'On-site production & staffing',
  'Full event-day production, AV, and crew.',
  'Customer confirms event-day delivery matched the approved run-of-show.',
  25000.00,
  'active',
  NULL, NULL,
  now() - interval '14 days',
  now()
),
(
  'a0606001-0001-4000-8000-000000000003',
  '22222222-2222-2222-2222-222222222230',
  3,
  'Post-event wrap-up & reporting',
  'Teardown, vendor reconciliation, and post-event report.',
  'Customer accepts final wrap-up report and closes the engagement.',
  10000.00,
  'active',
  NULL, NULL,
  now() - interval '14 days',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  completion_definition = EXCLUDED.completion_definition,
  amount = EXCLUDED.amount,
  status = EXCLUDED.status,
  ready_for_approval_at = EXCLUDED.ready_for_approval_at,
  updated_at = now();

-- Initial installment for PO1 (prepayment / down payment) — unearned until PO1 approved
INSERT INTO public.deposits (
  id, contract_id, customer_id, amount, received_at, status, performance_obligation_id
) VALUES (
  'd0606001-0001-4000-8000-000000000001',
  '22222222-2222-2222-2222-222222222230',
  '11111111-1111-1111-1111-111111111108',
  15000.00,
  CURRENT_DATE - 10,
  'unearned',
  'a0606001-0001-4000-8000-000000000001'
)
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  status = EXCLUDED.status,
  performance_obligation_id = EXCLUDED.performance_obligation_id;

UPDATE public.contract_performance_obligations
SET installment_deposit_id = 'd0606001-0001-4000-8000-000000000001',
    updated_at = now()
WHERE id = 'a0606001-0001-4000-8000-000000000001';

-- Holiday Reception $22,000 — all POs defined; PO1 awaiting approval with installment paid
INSERT INTO public.contract_performance_obligations (
  id, contract_id, seq, title, description, completion_definition, amount, status,
  ready_for_approval_at, ready_for_approval_by, created_at, updated_at
) VALUES
(
  'a0606001-0001-4000-8000-000000000011',
  '22222222-2222-2222-2222-222222222231',
  1,
  'Creative design & décor plan',
  'Theme, décor board, and guest experience plan.',
  'Customer approves creative package as complete.',
  7000.00,
  'awaiting_approval',
  now() - interval '1 day',
  'Alex Rivera',
  now() - interval '10 days',
  now()
),
(
  'a0606001-0001-4000-8000-000000000012',
  '22222222-2222-2222-2222-222222222231',
  2,
  'Reception production day',
  'Venue setup, catering coordination, and hosting.',
  'Customer confirms reception day performance was satisfactory.',
  12000.00,
  'active',
  NULL, NULL,
  now() - interval '10 days',
  now()
),
(
  'a0606001-0001-4000-8000-000000000013',
  '22222222-2222-2222-2222-222222222231',
  3,
  'Strike & guest follow-up',
  'Strike, inventory return, and thank-you package.',
  'Customer accepts strike completion and closes the reception engagement.',
  3000.00,
  'active',
  NULL, NULL,
  now() - interval '10 days',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  completion_definition = EXCLUDED.completion_definition,
  amount = EXCLUDED.amount,
  status = EXCLUDED.status,
  ready_for_approval_at = EXCLUDED.ready_for_approval_at,
  updated_at = now();

INSERT INTO public.deposits (
  id, contract_id, customer_id, amount, received_at, status, performance_obligation_id
) VALUES (
  'd0606001-0001-4000-8000-000000000011',
  '22222222-2222-2222-2222-222222222231',
  '11111111-1111-1111-1111-111111111108',
  7000.00,
  CURRENT_DATE - 7,
  'unearned',
  'a0606001-0001-4000-8000-000000000011'
)
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  status = EXCLUDED.status,
  performance_obligation_id = EXCLUDED.performance_obligation_id;

UPDATE public.contract_performance_obligations
SET installment_deposit_id = 'd0606001-0001-4000-8000-000000000011',
    updated_at = now()
WHERE id = 'a0606001-0001-4000-8000-000000000011';

-- GAAP policy row for ASC 606 PO installment gate (idempotent)
INSERT INTO public.gaap_policies (topic, asc_reference, mainevent_rule, evidence_required, sort_order)
SELECT
  'Performance obligations & installment gates',
  'ASC 606-10-25',
  'Each commercial PO is identified at negotiation with an allocated amount. Revenue is recognized only when the customer approves completion. Approving PO_i (not last) requires an installment equal to PO_{i+1}; final PO approval requires no new payment because prior installments already cover the contract.',
  'Customer typed approval + installment deposit reference (or final-PO confirmation that contract is fully prepaid).',
  20
WHERE NOT EXISTS (
  SELECT 1 FROM public.gaap_policies
  WHERE topic = 'Performance obligations & installment gates'
);
