-- Contracts lifecycle enrichment (safe UPDATE — does not truncate Billing tables).
-- Policy: deposit = % of original_contract_value; statuses demo full lifecycle.
-- Run on shared DB after contracts_engagements_foundation.

-- Ensure original values exist
UPDATE public.contracts
SET
  original_contract_value = COALESCE(original_contract_value, contract_value),
  project_manager_label = COALESCE(NULLIF(btrim(project_manager_label), ''), 'Alex Rivera')
WHERE true;

-- Lifecycle scenarios (same contract ids as Billing/GAAP seed where present)
UPDATE public.contracts SET
  status = 'closed',
  performance_complete = true,
  project_manager_label = 'Alex Rivera',
  event_type = 'corporate_conference',
  event_start = '2025-09-12 08:00:00+00',
  event_end = '2025-09-14 18:00:00+00',
  venue_name = 'Grand Meridian Ballrooms',
  venue_city = 'Chicago',
  guest_count = 320,
  approved_by = 'Alex Rivera',
  completed_at = '2025-09-14 20:00:00+00',
  closed_at = '2025-10-01 17:00:00+00',
  closeout_notes = 'All POs satisfied; final AR collected; closed for profit reporting.',
  cancellation_policy_text = '50% of fee if canceled within 30 days of event.',
  terms_locked_at = COALESCE(terms_locked_at, approved_at)
WHERE id = '22222222-2222-2222-2222-222222222201';

UPDATE public.contracts SET
  status = 'active',
  performance_complete = false,
  project_manager_label = 'Alex Rivera',
  event_type = 'gala',
  event_start = '2026-12-12 17:00:00+00',
  event_end = '2026-12-12 23:30:00+00',
  venue_name = 'Lakeshore Pavilion',
  venue_city = 'Chicago',
  guest_count = 450,
  approved_by = 'Alex Rivera',
  activated_at = '2026-01-21 15:00:00+00',
  cancellation_policy_text = 'Deposit forfeited if canceled within 60 days of event.',
  terms_locked_at = COALESCE(terms_locked_at, approved_at)
WHERE id = '22222222-2222-2222-2222-222222222202';
-- Deposit 25% of original 120000 = 30000 — seed deposit satisfies → active

UPDATE public.contracts SET
  status = 'completed',
  performance_complete = true,
  project_manager_label = 'Jordan Blake',
  event_type = 'corporate_conference',
  event_start = '2025-11-03 07:00:00+00',
  event_end = '2025-11-05 17:00:00+00',
  venue_name = 'Harborview Convention Center',
  venue_city = 'Seattle',
  guest_count = 600,
  approved_by = 'Jordan Blake',
  completed_at = '2025-11-05 19:00:00+00',
  cancellation_policy_text = '30% cancellation fee inside 45 days.',
  terms_locked_at = COALESCE(terms_locked_at, approved_at)
WHERE id = '22222222-2222-2222-2222-222222222203';

UPDATE public.contracts SET
  status = 'active',
  performance_complete = false,
  project_manager_label = 'Sam Okonkwo',
  event_type = 'product_launch',
  event_start = '2026-06-18 10:00:00+00',
  event_end = '2026-06-18 22:00:00+00',
  venue_name = 'Summit Studios',
  venue_city = 'Austin',
  guest_count = 280,
  approved_by = 'Sam Okonkwo',
  activated_at = '2026-02-06 12:00:00+00',
  cancellation_policy_text = 'Progress payments non-refundable after load-in scheduled.',
  terms_locked_at = COALESCE(terms_locked_at, approved_at)
WHERE id = '22222222-2222-2222-2222-222222222204';
-- Deposit 30% of 64000 = 19200 satisfied by seed deposit

UPDATE public.contracts SET
  status = 'completed',
  performance_complete = true,
  project_manager_label = 'Morgan Ellis',
  event_type = 'wedding',
  event_start = '2026-01-10 14:00:00+00',
  event_end = '2026-01-12 01:00:00+00',
  venue_name = 'Cedar Estate',
  venue_city = 'Napa',
  guest_count = 180,
  approved_by = 'Morgan Ellis',
  completed_at = '2026-01-12 02:00:00+00',
  cancellation_policy_text = '50% deposit non-refundable after venue hold.',
  terms_locked_at = COALESCE(terms_locked_at, approved_at)
WHERE id = '22222222-2222-2222-2222-222222222205';

UPDATE public.contracts SET
  status = 'active',
  performance_complete = false,
  project_manager_label = 'Jordan Blake',
  event_type = 'fundraiser',
  event_start = '2026-09-20 18:00:00+00',
  event_end = '2026-09-20 23:00:00+00',
  venue_name = 'Riverfront Hall',
  venue_city = 'Milwaukee',
  guest_count = 350,
  approved_by = 'Jordan Blake',
  activated_at = '2026-03-06 10:00:00+00',
  cancellation_policy_text = 'Sliding scale 14/30/60 days.',
  terms_locked_at = COALESCE(terms_locked_at, approved_at)
WHERE id = '22222222-2222-2222-2222-222222222206';
-- Deposit 35% of 55000 = 19250 satisfied

-- Remaining contracts (billing method demos): diversify statuses when present
UPDATE public.contracts SET
  status = 'deposit_pending',
  project_manager_label = COALESCE(project_manager_label, 'Alex Rivera'),
  event_type = COALESCE(event_type, 'corporate_event'),
  approved_by = COALESCE(approved_by, 'Alex Rivera'),
  terms_locked_at = COALESCE(terms_locked_at, approved_at, now())
WHERE id = '22222222-2222-2222-2222-222222222207';

UPDATE public.contracts SET
  status = 'pending_approval',
  project_manager_label = COALESCE(project_manager_label, 'Sam Okonkwo'),
  event_type = COALESCE(event_type, 'trade_show'),
  submitted_at = COALESCE(submitted_at, now()),
  submitted_by = COALESCE(submitted_by, 'Coordinator Lee'),
  approved_at = NULL,
  approved_by = NULL
WHERE id = '22222222-2222-2222-2222-222222222208';

UPDATE public.contracts SET
  status = 'draft',
  project_manager_label = COALESCE(project_manager_label, 'Morgan Ellis'),
  event_type = COALESCE(event_type, 'holiday_party'),
  approved_at = NULL,
  approved_by = NULL,
  performance_complete = false
WHERE id = '22222222-2222-2222-2222-222222222209';

UPDATE public.contracts SET
  status = 'canceled',
  project_manager_label = COALESCE(project_manager_label, 'Alex Rivera'),
  event_type = COALESCE(event_type, 'concert'),
  canceled_at = COALESCE(canceled_at, now()),
  cancel_reason = COALESCE(cancel_reason, 'Client postponed indefinitely; per policy forfeit applies.'),
  canceled_by = COALESCE(canceled_by, 'Alex Rivera'),
  cancellation_fee_percent = GREATEST(cancellation_fee_percent, 25),
  performance_complete = false
WHERE id = '22222222-2222-2222-2222-222222222210';

UPDATE public.contracts SET
  status = 'active',
  project_manager_label = COALESCE(project_manager_label, 'Jordan Blake'),
  event_type = COALESCE(event_type, 'celebration'),
  approved_by = COALESCE(approved_by, 'Jordan Blake'),
  activated_at = COALESCE(activated_at, now())
WHERE id IN (
  '22222222-2222-2222-2222-222222222211',
  '22222222-2222-2222-2222-222222222212'
);

-- Sample commercial line items for active / closed demos (idempotent)
INSERT INTO public.contract_line_items (
  contract_id, line_number, line_type, description, quantity, unit_rate, amount, sort_order
)
SELECT c.id, 1, 'package', 'Full production package', 1, c.contract_value * 0.7, c.contract_value * 0.7, 1
FROM public.contracts c
WHERE c.id IN (
  '22222222-2222-2222-2222-222222222201',
  '22222222-2222-2222-2222-222222222202',
  '22222222-2222-2222-2222-222222222204'
)
AND NOT EXISTS (
  SELECT 1 FROM public.contract_line_items li WHERE li.contract_id = c.id AND li.line_number = 1
);

INSERT INTO public.contract_line_items (
  contract_id, line_number, line_type, description, quantity, unit_rate, amount, sort_order
)
SELECT c.id, 2, 'service', 'On-site show calling', 1, c.contract_value * 0.3, c.contract_value * 0.3, 2
FROM public.contracts c
WHERE c.id IN (
  '22222222-2222-2222-2222-222222222201',
  '22222222-2222-2222-2222-222222222202',
  '22222222-2222-2222-2222-222222222204'
)
AND NOT EXISTS (
  SELECT 1 FROM public.contract_line_items li WHERE li.contract_id = c.id AND li.line_number = 2
);

-- Tag deposit milestones where helpful
UPDATE public.contract_milestones
SET milestone_type = 'deposit', sequence_no = 1
WHERE lower(milestone_key) LIKE '%deposit%' OR lower(label) LIKE '%deposit%';

UPDATE public.contract_milestones
SET milestone_type = 'final', sequence_no = 99
WHERE lower(milestone_key) LIKE '%final%' OR lower(label) LIKE '%final%';
