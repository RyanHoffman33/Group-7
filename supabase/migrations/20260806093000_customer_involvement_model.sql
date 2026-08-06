-- Customer Involvement Model for MainEvent contracts
-- New nullable/default column + new tables only. No destructive changes.
-- Project: ACCY628-FINAL-PROJECT (eslwjydxevrdgeiqkwtq)

-- ---------------------------------------------------------------------------
-- 1) Involvement model on contracts
-- ---------------------------------------------------------------------------
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS involvement_model text;

UPDATE public.contracts
SET involvement_model = COALESCE(involvement_model, 'collaborative')
WHERE involvement_model IS NULL;

ALTER TABLE public.contracts
  ALTER COLUMN involvement_model SET DEFAULT 'collaborative';

ALTER TABLE public.contracts
  ALTER COLUMN involvement_model SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_involvement_model_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_involvement_model_check
      CHECK (
        involvement_model = ANY (ARRAY[
          'collaborative'::text,
          'full_service'::text,
          'custom'::text
        ])
      );
  END IF;
END $$;

-- Mix models across existing seed contracts for demos
UPDATE public.contracts SET involvement_model = 'full_service'
WHERE id IN (
  '22222222-2222-2222-2222-222222222202',
  '22222222-2222-2222-2222-222222222206',
  '22222222-2222-2222-2222-222222222224'
);

UPDATE public.contracts SET involvement_model = 'custom'
WHERE id IN (
  '22222222-2222-2222-2222-222222222204',
  '22222222-2222-2222-2222-222222222211'
);

UPDATE public.contracts SET involvement_model = 'collaborative'
WHERE involvement_model IS NULL
   OR id NOT IN (
  '22222222-2222-2222-2222-222222222202',
  '22222222-2222-2222-2222-222222222206',
  '22222222-2222-2222-2222-222222222224',
  '22222222-2222-2222-2222-222222222204',
  '22222222-2222-2222-2222-222222222211'
);

-- ---------------------------------------------------------------------------
-- 2) Custom model: per-contract required checkpoint types
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_involvement_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  checkpoint_type text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_involvement_checkpoints_unique
    UNIQUE (contract_id, checkpoint_type)
);

CREATE INDEX IF NOT EXISTS contract_involvement_checkpoints_contract_idx
  ON public.contract_involvement_checkpoints (contract_id);

-- ---------------------------------------------------------------------------
-- 3) Customer approval items (versioned) + decisions history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_approval_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  checkpoint_type text NOT NULL,
  title text NOT NULL,
  item_key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  supporting_info text,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  created_by text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_approval_items_status_check
    CHECK (status = ANY (ARRAY[
      'draft'::text,
      'pending'::text,
      'approved'::text,
      'changes_requested'::text,
      'superseded'::text
    ])),
  CONSTRAINT customer_approval_items_version_check
    CHECK (version >= 1),
  CONSTRAINT customer_approval_items_version_unique
    UNIQUE (contract_id, item_key, version)
);

CREATE INDEX IF NOT EXISTS customer_approval_items_contract_idx
  ON public.customer_approval_items (contract_id);

CREATE INDEX IF NOT EXISTS customer_approval_items_status_idx
  ON public.customer_approval_items (status);

CREATE INDEX IF NOT EXISTS customer_approval_items_item_key_idx
  ON public.customer_approval_items (contract_id, item_key);

CREATE TABLE IF NOT EXISTS public.customer_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_item_id uuid NOT NULL
    REFERENCES public.customer_approval_items(id) ON DELETE CASCADE,
  decision text NOT NULL,
  comments text,
  customer_contact text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  approved_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_approval_decisions_decision_check
    CHECK (decision = ANY (ARRAY[
      'approved'::text,
      'changes_requested'::text
    ])),
  CONSTRAINT customer_approval_decisions_version_check
    CHECK (approved_version >= 1)
);

CREATE INDEX IF NOT EXISTS customer_approval_decisions_item_idx
  ON public.customer_approval_decisions (approval_item_id);

CREATE INDEX IF NOT EXISTS customer_approval_decisions_decided_idx
  ON public.customer_approval_decisions (decided_at DESC);

-- ---------------------------------------------------------------------------
-- 4) RLS (demo-permissive, matching other contract tables)
-- ---------------------------------------------------------------------------
ALTER TABLE public.contract_involvement_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_approval_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_approval_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_involvement_checkpoints_demo_all
  ON public.contract_involvement_checkpoints;
CREATE POLICY contract_involvement_checkpoints_demo_all
  ON public.contract_involvement_checkpoints
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS customer_approval_items_demo_all
  ON public.customer_approval_items;
CREATE POLICY customer_approval_items_demo_all
  ON public.customer_approval_items
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS customer_approval_decisions_demo_all
  ON public.customer_approval_decisions;
CREATE POLICY customer_approval_decisions_demo_all
  ON public.customer_approval_decisions
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_involvement_checkpoints
  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_approval_items
  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_approval_decisions
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Seed: Delta Consulting (demo customer@) + contracts + approvals
-- ---------------------------------------------------------------------------
INSERT INTO public.customers (id, name, billing_email, payment_terms_days, status)
VALUES (
  '11111111-1111-1111-1111-111111111108',
  'Delta Consulting',
  'customer@gmail.com',
  30,
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  billing_email = EXCLUDED.billing_email,
  status = EXCLUDED.status;

INSERT INTO public.contracts (
  id, customer_id, contract_number, event_name, contract_value, original_contract_value,
  deposit_required, deposit_percent, status, performance_complete, approved_at,
  billing_method, event_type, event_start, event_end, venue_name, venue_city,
  guest_count, project_manager_label, approved_by, involvement_model,
  cancellation_policy_text, cancellation_fee_percent, currency, notes
) VALUES
(
  '22222222-2222-2222-2222-222222222230',
  '11111111-1111-1111-1111-111111111108',
  'ME-2026-222222222230',
  'Delta Leadership Conference',
  50000, 50000, true, 25, 'active', false, '2026-05-01',
  'fixed_price', 'corporate_conference',
  '2026-09-18 08:00:00+00', '2026-09-19 18:00:00+00',
  'The Jefferson Hotel', 'Richmond', 250, 'Emily Gray', 'Emily Gray',
  'collaborative',
  'Cancel 30+ days: 25% fee; within 30 days: 50% of contract value.',
  25, 'USD',
  'Customer portal demo — collaborative involvement.'
),
(
  '22222222-2222-2222-2222-222222222231',
  '11111111-1111-1111-1111-111111111108',
  'ME-2026-222222222231',
  'Delta Holiday Reception',
  22000, 22000, true, 30, 'active', false, '2026-06-15',
  'fixed_price', 'holiday_party',
  '2026-12-12 18:00:00+00', '2026-12-12 23:00:00+00',
  'Grand Ballroom', 'Richmond', 120, 'Emily Gray', 'Emily Gray',
  'full_service',
  'Cancel 14+ days: 20% fee; within 14 days: 40% of contract value.',
  20, 'USD',
  'Customer portal demo — full-service involvement.'
),
(
  '22222222-2222-2222-2222-222222222232',
  '11111111-1111-1111-1111-111111111108',
  'ME-2026-222222222232',
  'Delta Spring Client Workshop',
  18000, 18000, true, 25, 'active', false, '2026-07-01',
  'milestone', 'corporate_event',
  '2026-04-10 09:00:00+00', '2026-04-10 17:00:00+00',
  'MainEvent Studio A', 'Richmond', 80, 'Alex Rivera', 'Alex Rivera',
  'custom',
  'Standard workshop cancellation: 15% if canceled within 21 days.',
  15, 'USD',
  'Customer portal demo — custom involvement checklist.'
)
ON CONFLICT (id) DO UPDATE SET
  involvement_model = EXCLUDED.involvement_model,
  event_name = EXCLUDED.event_name,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;

-- Custom checkpoints for Spring Workshop
INSERT INTO public.contract_involvement_checkpoints
  (id, contract_id, checkpoint_type, required)
VALUES
  ('a1000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222232', 'venue', true),
  ('a1000000-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222232', 'budget', true),
  ('a1000000-0000-4000-8000-000000000003', '22222222-2222-2222-2222-222222222232', 'final_run_of_show', true),
  ('a1000000-0000-4000-8000-000000000004', '22222222-2222-2222-2222-222222222232', 'change_order', true),
  ('a1000000-0000-4000-8000-000000000005', '22222222-2222-2222-2222-222222222232', 'cancellation', true)
ON CONFLICT (contract_id, checkpoint_type) DO UPDATE SET required = EXCLUDED.required;

-- Custom checkpoints for Product Launch Experience (existing custom model)
INSERT INTO public.contract_involvement_checkpoints
  (contract_id, checkpoint_type, required)
VALUES
  ('22222222-2222-2222-2222-222222222204', 'event_concept', true),
  ('22222222-2222-2222-2222-222222222204', 'venue', true),
  ('22222222-2222-2222-2222-222222222204', 'major_vendors', true),
  ('22222222-2222-2222-2222-222222222204', 'change_order', true),
  ('22222222-2222-2222-2222-222222222204', 'contract_value_increase', true)
ON CONFLICT (contract_id, checkpoint_type) DO NOTHING;

-- Pending + historical approval requests for Delta Leadership (collaborative)
INSERT INTO public.customer_approval_items (
  id, contract_id, checkpoint_type, title, item_key, version,
  supporting_info, due_date, status, created_by, sent_at
) VALUES
(
  'b1000000-0000-4000-8000-000000000001',
  '22222222-2222-2222-2222-222222222230',
  'budget',
  'Approve catering package & budget allowance',
  'budget-catering',
  1,
  $info$Chef proposes plated lunch (chicken + vegetarian) with gluten-free option, plus AM/PM coffee breaks. Estimated per-person cost is within your contracted catering allowance.

Options:
• Plated lunch — chicken or vegetarian
• Gluten-free plates available on request
• Coffee & tea service (morning + afternoon)
• Reception hors d'oeuvres for 250$info$,
  '2026-08-08',
  'pending',
  'Emily Gray',
  now()
),
(
  'b1000000-0000-4000-8000-000000000002',
  '22222222-2222-2222-2222-222222222230',
  'decor_production_design',
  'Approve updated floor plan & stage orientation',
  'decor-floor-plan',
  1,
  $info$Revised floor plan moves the LED wall 8 feet upstage and adds two breakout clusters near the foyer. Capacity remains 250 seated.

Options:
• Theater seating for keynote (250)
• LED wall centered on south wall
• Two breakout pods near foyer
• Registration desk at Franklin St entrance$info$,
  '2026-08-09',
  'pending',
  'Emily Gray',
  now()
),
(
  'b1000000-0000-4000-8000-000000000003',
  '22222222-2222-2222-2222-222222222230',
  'venue',
  'Confirm Jefferson Hotel ballroom hold',
  'venue-jefferson',
  1,
  'Venue hold confirmed for Grand Ballroom + foyer breakouts on Sep 18–19. Room rental and F&B minimums match the signed contract.',
  '2026-05-12',
  'approved',
  'Emily Gray',
  '2026-05-10T15:00:00+00'
),
(
  'b1000000-0000-4000-8000-000000000004',
  '22222222-2222-2222-2222-222222222230',
  'event_concept',
  'Approve event concept & agenda outline',
  'concept-agenda',
  1,
  'Two-day leadership conference: general session, breakouts, evening reception. MainEvent producing AV, staging, and guest experience.',
  '2026-05-05',
  'superseded',
  'Emily Gray',
  '2026-05-01T12:00:00+00'
),
(
  'b1000000-0000-4000-8000-000000000005',
  '22222222-2222-2222-2222-222222222230',
  'event_concept',
  'Approve event concept & agenda outline (v2)',
  'concept-agenda',
  2,
  'Updated agenda adds a closing town-hall and shortens day-1 breakouts. Still within contracted production hours.',
  '2026-05-20',
  'approved',
  'Emily Gray',
  '2026-05-15T12:00:00+00'
),
-- Full-service: only major change-type approvals
(
  'b1000000-0000-4000-8000-000000000010',
  '22222222-2222-2222-2222-222222222231',
  'venue_or_date_change',
  'Approve date change to Dec 12',
  'date-change-dec',
  1,
  'Original hold was Dec 5. Venue availability moved the reception to Dec 12 (same Grand Ballroom). No contract value change.',
  '2026-07-15',
  'pending',
  'Emily Gray',
  now()
),
(
  'b1000000-0000-4000-8000-000000000011',
  '22222222-2222-2222-2222-222222222231',
  'change_order',
  'Approve change order — branded photo backdrop',
  'co-photo-backdrop',
  1,
  'Add branded photo backdrop and attendant for the holiday reception. Price change +$1,850. Within residual contingency unless you prefer a formal CO.',
  '2026-08-20',
  'pending',
  'Emily Gray',
  now()
),
-- Custom workshop
(
  'b1000000-0000-4000-8000-000000000020',
  '22222222-2222-2222-2222-222222222232',
  'budget',
  'Approve workshop AV budget package',
  'budget-av',
  1,
  'Half-day AV package with dual projectors and wireless mics. Total $4,200 — within the custom-approved budget checkpoint.',
  '2026-08-12',
  'pending',
  'Alex Rivera',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_approval_decisions (
  id, approval_item_id, decision, comments, customer_contact, decided_at, approved_version
) VALUES
(
  'c1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000003',
  'approved',
  'Venue looks great — please proceed with the hold.',
  'Casey Customer',
  '2026-05-11T14:30:00+00',
  1
),
(
  'c1000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000004',
  'changes_requested',
  'Please add a closing town-hall and shorten afternoon breakouts on day 1.',
  'Casey Customer',
  '2026-05-04T16:00:00+00',
  1
),
(
  'c1000000-0000-4000-8000-000000000003',
  'b1000000-0000-4000-8000-000000000005',
  'approved',
  'v2 agenda works for our leadership team.',
  'Casey Customer',
  '2026-05-18T10:15:00+00',
  2
)
ON CONFLICT (id) DO NOTHING;
