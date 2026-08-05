-- Seed Data Overhaul & Cross-Module Integrity (data only)
-- Safe upserts / updates — does not TRUNCATE billing tables.
-- Project: ACCY628-FINAL-PROJECT

-- ---------------------------------------------------------------------------
-- 1) Fill missing event dates so contracts span the calendar year
-- ---------------------------------------------------------------------------
UPDATE public.contracts SET
  event_start = '2026-04-15 09:00:00+00',
  event_end   = '2026-04-17 17:00:00+00',
  event_type  = COALESCE(event_type, 'corporate_event'),
  venue_name  = COALESCE(venue_name, 'Northstar Retreat Center'),
  venue_city  = COALESCE(venue_city, 'Chicago')
WHERE id = '22222222-2222-2222-2222-222222222207';

UPDATE public.contracts SET
  event_start = '2026-03-22 18:00:00+00',
  event_end   = '2026-03-22 21:00:00+00',
  event_type  = COALESCE(event_type, 'trade_show'),
  venue_name  = COALESCE(venue_name, 'Summit Arena'),
  venue_city  = COALESCE(venue_city, 'Austin')
WHERE id = '22222222-2222-2222-2222-222222222208';

UPDATE public.contracts SET
  event_start = '2026-05-09 15:00:00+00',
  event_end   = '2026-05-09 22:00:00+00',
  event_type  = COALESCE(event_type, 'wedding'),
  venue_name  = COALESCE(venue_name, 'Cedar Estate Chapel'),
  venue_city  = COALESCE(venue_city, 'Napa')
WHERE id = '22222222-2222-2222-2222-222222222209';

UPDATE public.contracts SET
  event_start = '2026-07-01 08:00:00+00',
  event_end   = '2026-07-05 18:00:00+00',
  event_type  = COALESCE(event_type, 'corporate_event'),
  venue_name  = COALESCE(venue_name, 'Multi-city travel'),
  venue_city  = COALESCE(venue_city, 'Seattle')
WHERE id = '22222222-2222-2222-2222-222222222210';

UPDATE public.contracts SET
  event_start = '2026-01-01 00:00:00+00',
  event_end   = '2026-12-31 23:59:00+00',
  event_type  = COALESCE(event_type, 'corporate_event'),
  venue_name  = COALESCE(venue_name, 'Retainer — multi-site'),
  venue_city  = COALESCE(venue_city, 'Milwaukee')
WHERE id = '22222222-2222-2222-2222-222222222211';

UPDATE public.contracts SET
  event_start = '2026-10-15 10:00:00+00',
  event_end   = '2026-10-15 22:00:00+00',
  event_type  = COALESCE(event_type, 'product_launch'),
  venue_name  = COALESCE(venue_name, 'Lakeshore Pavilion'),
  venue_city  = COALESCE(venue_city, 'Chicago')
WHERE id = '22222222-2222-2222-2222-222222222212';

-- ---------------------------------------------------------------------------
-- 2) New contracts for months that lacked coverage + edge cases
--    220 = unprofitable completed (Mar 2026)
--    221 = autumn workshop closed (Oct 2025)
--    222 = expired MSA closed (May 2025 — agreement lapsed)
--    223 = winter dinner completed (Feb 2026)
--    224 = summer showcase active (Aug 2026)
-- ---------------------------------------------------------------------------
INSERT INTO public.customers (id, name, billing_email, payment_terms_days, status)
VALUES
  ('11111111-1111-1111-1111-111111111106', 'Prairie Arts Collective', 'billing@prairiearts.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111107', 'Lakeside University', 'events@lakesideu.example', 45, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contracts (
  id, customer_id, contract_number, event_name, contract_value, original_contract_value,
  deposit_required, deposit_percent, status, performance_complete, approved_at,
  billing_method, event_type, event_start, event_end, venue_name, venue_city,
  guest_count, project_manager_label, approved_by, completed_at, closed_at, closeout_notes,
  change_order_value_total, progress_percent
) VALUES
  (
    '22222222-2222-2222-2222-222222222220',
    '11111111-1111-1111-1111-111111111106',
    'ME-2026-222222222220',
    'Spring Mixer — Margin Loss Demo',
    28000, 28000, true, 25, 'completed', true, '2026-01-20',
    'fixed_price', 'fundraiser',
    '2026-03-14 18:00:00+00', '2026-03-14 23:00:00+00',
    'Prairie Hall', 'Des Moines', 180, 'Morgan Ellis', 'Morgan Ellis',
    '2026-03-15 01:00:00+00', NULL,
    'Completed; costs exceeded recognized revenue (unprofitable demo).',
    0, 100
  ),
  (
    '22222222-2222-2222-2222-222222222221',
    '11111111-1111-1111-1111-111111111107',
    'ME-2025-222222222221',
    'Autumn Faculty Workshop',
    36000, 36000, true, 30, 'closed', true, '2025-08-01',
    'fixed_price', 'corporate_conference',
    '2025-10-18 08:00:00+00', '2025-10-18 17:00:00+00',
    'Lakeside Union', 'Madison', 120, 'Alex Rivera', 'Alex Rivera',
    '2025-10-18 18:00:00+00', '2025-11-05 17:00:00+00',
    'Closed after final AR collection.',
    0, 100
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111103',
    'ME-2025-222222222222',
    'Summit Annual MSA (Expired)',
    48000, 48000, false, 0, 'closed', false, '2024-05-01',
    'retainer', 'corporate_event',
    '2025-05-01 00:00:00+00', '2025-05-01 00:00:00+00',
    'N/A — agreement term', 'Austin', NULL, 'Sam Okonkwo', 'Sam Okonkwo',
    NULL, '2025-05-31 17:00:00+00',
    'EXPIRED AGREEMENT: annual MSA lapsed 2025-05-31 without renewal; no further performance.',
    0, 0
  ),
  (
    '22222222-2222-2222-2222-222222222223',
    '11111111-1111-1111-1111-111111111101',
    'ME-2026-222222222223',
    'Northstar Winter Client Dinner',
    52000, 52000, true, 40, 'completed', true, '2025-12-01',
    'milestone', 'gala',
    '2026-02-14 18:00:00+00', '2026-02-14 23:00:00+00',
    'Meridian Club', 'Chicago', 90, 'Alex Rivera', 'Alex Rivera',
    '2026-02-15 00:30:00+00', NULL,
    'Completed winter dinner; final invoice paid.',
    0, 100
  ),
  (
    '22222222-2222-2222-2222-222222222224',
    '11111111-1111-1111-1111-111111111102',
    'ME-2026-222222222224',
    'Harborview Summer Showcase',
    67000, 67000, true, 30, 'active', false, '2026-05-01',
    'progress', 'corporate_conference',
    '2026-08-22 09:00:00+00', '2026-08-22 17:00:00+00',
    'Harborview Atrium', 'Seattle', 240, 'Jordan Blake', 'Jordan Blake',
    NULL, NULL, NULL, 0, 35
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Integrity: billed amounts must reconcile via change orders
--    Physician Conference: billed 115k vs CV 95k → CO +20k
--    Q3 Summit: billed 87.5k vs CV 85k → CO +2.5k
-- ---------------------------------------------------------------------------
INSERT INTO public.contract_modifications (
  id, contract_id, mod_number, effective_date, description, price_change,
  prior_contract_value, scope_change_notes, accounting_treatment, status, approved_by, approved_at
) VALUES
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10',
    '22222222-2222-2222-2222-222222222203',
    'CO-001', '2025-12-01',
    'Add post-conference CME recording package',
    20000, 95000,
    'Distinct add-on — prospective; supports INV-2026-0008 balance bill',
    'prospective', 'approved', 'Jordan Blake', '2025-12-02'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11',
    '22222222-2222-2222-2222-222222222201',
    'CO-001', '2026-07-15',
    'Punch-list AV day + strike overtime',
    2500, 85000,
    'Distinct residual services after close — supports INV-2026-0014',
    'prospective', 'approved', 'Alex Rivera', '2026-07-16'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12',
    '22222222-2222-2222-2222-222222222211',
    'REN-001', '2026-07-01',
    'Annual retainer renewal — FY2026 H2',
    0, 42000,
    'Renewal of recurring retainer for second half; same TP series',
    'prospective', 'approved', 'Jordan Blake', '2026-06-28'
  )
ON CONFLICT (id) DO NOTHING;

UPDATE public.contracts SET
  contract_value = 115000,
  change_order_value_total = GREATEST(change_order_value_total, 20000),
  original_contract_value = COALESCE(NULLIF(original_contract_value, 0), 95000)
WHERE id = '22222222-2222-2222-2222-222222222203';

UPDATE public.contracts SET
  contract_value = 87500,
  change_order_value_total = GREATEST(change_order_value_total, 2500),
  original_contract_value = COALESCE(NULLIF(original_contract_value, 0), 85000)
WHERE id = '22222222-2222-2222-2222-222222222201';

-- Product Launch CO already in seed — ensure CV includes approved +8500
UPDATE public.contracts SET
  contract_value = GREATEST(contract_value, original_contract_value + 8500),
  change_order_value_total = GREATEST(change_order_value_total, 8500),
  original_contract_value = COALESCE(NULLIF(original_contract_value, 0), 64000)
WHERE id = '22222222-2222-2222-2222-222222222204';

-- ---------------------------------------------------------------------------
-- 4) Invoices + lines for new contracts; fill missing lines on old paid invoices
-- ---------------------------------------------------------------------------
INSERT INTO public.invoices (
  id, contract_id, customer_id, invoice_number, issue_date, due_date,
  subtotal, tax, total, status, recognition_status, milestone_key, created_by
) VALUES
  -- Unprofitable spring mixer: fully recognized but costs >> revenue
  ('33333333-3333-3333-3333-333333333320', '22222222-2222-2222-2222-222222222220', '11111111-1111-1111-1111-111111111106',
   'INV-2026-0020', '2026-02-01', '2026-03-03', 7000, 0, 7000, 'paid', 'recognized', 'mixer-deposit', 'seed'),
  ('33333333-3333-3333-3333-333333333321', '22222222-2222-2222-2222-222222222220', '11111111-1111-1111-1111-111111111106',
   'INV-2026-0021', '2026-03-16', '2026-04-15', 21000, 0, 21000, 'paid', 'recognized', 'mixer-final', 'seed'),
  -- Autumn workshop
  ('33333333-3333-3333-3333-333333333322', '22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111107',
   'INV-2025-0022', '2025-09-01', '2025-10-01', 10800, 0, 10800, 'paid', 'recognized', 'workshop-deposit', 'seed'),
  ('33333333-3333-3333-3333-333333333323', '22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111107',
   'INV-2025-0023', '2025-10-20', '2025-11-19', 25200, 0, 25200, 'paid', 'recognized', 'workshop-final', 'seed'),
  -- Expired MSA — final stub invoice unpaid then canceled path not needed; disputed historical
  ('33333333-3333-3333-3333-333333333324', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111103',
   'INV-2025-0024', '2025-04-01', '2025-05-01', 4000, 0, 4000, 'canceled', 'deferred', 'msa-april', 'seed'),
  -- Winter dinner
  ('33333333-3333-3333-3333-333333333325', '22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111101',
   'INV-2026-0025', '2025-12-15', '2026-01-14', 20800, 0, 20800, 'paid', 'recognized', 'winter-deposit', 'seed'),
  ('33333333-3333-3333-3333-333333333326', '22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111101',
   'INV-2026-0026', '2026-02-16', '2026-03-18', 31200, 0, 31200, 'paid', 'recognized', 'winter-final', 'seed'),
  -- Summer showcase progress + unpaid
  ('33333333-3333-3333-3333-333333333327', '22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111102',
   'INV-2026-0027', '2026-06-01', '2026-07-01', 20100, 0, 20100, 'partially_paid', 'deferred', 'showcase-progress', 'seed'),
  ('33333333-3333-3333-3333-333333333328', '22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111102',
   'INV-2026-0028', '2026-07-15', '2026-08-14', 15000, 0, 15000, 'unpaid', 'deferred', 'showcase-mid', 'seed')
ON CONFLICT (id) DO NOTHING;

-- Line items: all invoices should have charge detail
INSERT INTO public.invoice_lines (invoice_id, description, amount, performance_obligation_ref)
SELECT v.invoice_id, v.description, v.amount, v.pref
FROM (VALUES
  ('33333333-3333-3333-3333-333333333301'::uuid, 'Q3 Leadership Summit — deposit / planning', 25000::numeric, 'PO-planning'),
  ('33333333-3333-3333-3333-333333333302', 'Q3 Leadership Summit — production milestone', 30000, 'PO-production'),
  ('33333333-3333-3333-3333-333333333303', 'Q3 Leadership Summit — event delivery', 30000, 'PO-event'),
  ('33333333-3333-3333-3333-333333333304', 'Physician Conference — deposit', 40000, 'PO-deposit'),
  ('33333333-3333-3333-3333-333333333305', 'Physician Conference — mid-event progress', 30000, 'PO-progress'),
  ('33333333-3333-3333-3333-333333333306', 'Physician Conference — completion', 25000, 'PO-event'),
  ('33333333-3333-3333-3333-333333333320', 'Spring Mixer — planning deposit (25%)', 7000, 'PO-deposit'),
  ('33333333-3333-3333-3333-333333333321', 'Spring Mixer — venue production & staffing', 14000, 'PO-event'),
  ('33333333-3333-3333-3333-333333333321', 'Spring Mixer — catering & bar package', 7000, 'PO-event'),
  ('33333333-3333-3333-3333-333333333322', 'Autumn Workshop — deposit (30%)', 10800, 'PO-deposit'),
  ('33333333-3333-3333-3333-333333333323', 'Autumn Workshop — facilitation & AV', 18000, 'PO-event'),
  ('33333333-3333-3333-3333-333333333323', 'Autumn Workshop — materials & print', 7200, 'PO-event'),
  ('33333333-3333-3333-3333-333333333324', 'Expired MSA — April retainer draw (voided)', 4000, 'PO-retainer'),
  ('33333333-3333-3333-3333-333333333325', 'Winter Dinner — deposit (40%)', 20800, 'PO-deposit'),
  ('33333333-3333-3333-3333-333333333326', 'Winter Dinner — plated dinner & décor', 22000, 'PO-event'),
  ('33333333-3333-3333-3333-333333333326', 'Winter Dinner — entertainment & staffing', 9200, 'PO-event'),
  ('33333333-3333-3333-3333-333333333327', 'Summer Showcase — progress billing (30%)', 20100, 'PO-progress'),
  ('33333333-3333-3333-3333-333333333328', 'Summer Showcase — mid-build milestone', 15000, 'PO-progress')
) AS v(invoice_id, description, amount, pref)
WHERE EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = v.invoice_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_lines il
    WHERE il.invoice_id = v.invoice_id AND il.description = v.description
  );

-- Payments for new paid invoices
INSERT INTO public.payments (id, customer_id, amount, paid_at, method, reference) VALUES
  ('55555555-5555-5555-5555-555555555520', '11111111-1111-1111-1111-111111111106', 7000, '2026-02-05', 'ach', 'PA-MIX-01'),
  ('55555555-5555-5555-5555-555555555521', '11111111-1111-1111-1111-111111111106', 21000, '2026-03-20', 'wire', 'PA-MIX-02'),
  ('55555555-5555-5555-5555-555555555522', '11111111-1111-1111-1111-111111111107', 10800, '2025-09-10', 'ach', 'LU-WS-01'),
  ('55555555-5555-5555-5555-555555555523', '11111111-1111-1111-1111-111111111107', 25200, '2025-11-01', 'ach', 'LU-WS-02'),
  ('55555555-5555-5555-5555-555555555525', '11111111-1111-1111-1111-111111111101', 20800, '2025-12-20', 'ach', 'NS-WIN-01'),
  ('55555555-5555-5555-5555-555555555526', '11111111-1111-1111-1111-111111111101', 31200, '2026-02-28', 'wire', 'NS-WIN-02'),
  ('55555555-5555-5555-5555-555555555527', '11111111-1111-1111-1111-111111111102', 10000, '2026-06-20', 'ach', 'HV-SS-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payment_applications (payment_id, invoice_id, amount)
SELECT * FROM (VALUES
  ('55555555-5555-5555-5555-555555555520'::uuid, '33333333-3333-3333-3333-333333333320'::uuid, 7000::numeric),
  ('55555555-5555-5555-5555-555555555521', '33333333-3333-3333-3333-333333333321', 21000),
  ('55555555-5555-5555-5555-555555555522', '33333333-3333-3333-3333-333333333322', 10800),
  ('55555555-5555-5555-5555-555555555523', '33333333-3333-3333-3333-333333333323', 25200),
  ('55555555-5555-5555-5555-555555555525', '33333333-3333-3333-3333-333333333325', 20800),
  ('55555555-5555-5555-5555-555555555526', '33333333-3333-3333-3333-333333333326', 31200),
  ('55555555-5555-5555-5555-555555555527', '33333333-3333-3333-3333-333333333327', 10000)
) AS v(payment_id, invoice_id, amount)
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_applications pa
  WHERE pa.payment_id = v.payment_id AND pa.invoice_id = v.invoice_id
);

INSERT INTO public.ar_bucket_state (invoice_id, current_bucket, outstanding_amount)
VALUES
  ('33333333-3333-3333-3333-333333333327', '1-30', 10100),
  ('33333333-3333-3333-3333-333333333328', 'current', 15000)
ON CONFLICT (invoice_id) DO UPDATE
SET current_bucket = EXCLUDED.current_bucket,
    outstanding_amount = EXCLUDED.outstanding_amount;

INSERT INTO public.recognition_evidence (id, contract_id, invoice_id, evidence_type, evidence_date, description, supporting_ref)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10', '22222222-2222-2222-2222-222222222220', '33333333-3333-3333-3333-333333333321',
   'event_completion', '2026-03-15', 'Spring Mixer delivered; walkthrough signed despite cost overrun', 'DOC-PA-CLOSE-020'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11', '22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333323',
   'delivery_acceptance', '2025-10-18', 'Faculty workshop complete', 'DOC-LU-ACCEPT-023'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12', '22222222-2222-2222-2222-222222222223', '33333333-3333-3333-3333-333333333326',
   'event_completion', '2026-02-15', 'Winter dinner completed', 'DOC-NS-WIN-026')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) Budgets + cost entries (unprofitable mixer + year-spread actuals)
-- ---------------------------------------------------------------------------
INSERT INTO public.cost_budgets (contract_id, category, budgeted_amount) VALUES
  ('22222222-2222-2222-2222-222222222220', 'labor', 6000),
  ('22222222-2222-2222-2222-222222222220', 'vendor', 12000),
  ('22222222-2222-2222-2222-222222222220', 'equipment', 4000),
  ('22222222-2222-2222-2222-222222222220', 'materials', 2500),
  ('22222222-2222-2222-2222-222222222221', 'labor', 8000),
  ('22222222-2222-2222-2222-222222222221', 'vendor', 9000),
  ('22222222-2222-2222-2222-222222222221', 'equipment', 3500),
  ('22222222-2222-2222-2222-222222222223', 'labor', 7000),
  ('22222222-2222-2222-2222-222222222223', 'vendor', 15000),
  ('22222222-2222-2222-2222-222222222223', 'equipment', 5000),
  ('22222222-2222-2222-2222-222222222224', 'labor', 9000),
  ('22222222-2222-2222-2222-222222222224', 'vendor', 16000),
  ('22222222-2222-2222-2222-222222222224', 'equipment', 7000),
  ('22222222-2222-2222-2222-222222222201', 'labor', 7000),
  ('22222222-2222-2222-2222-222222222201', 'vendor', 7000),
  ('22222222-2222-2222-2222-222222222201', 'equipment', 2000),
  ('22222222-2222-2222-2222-222222222202', 'labor', 12000),
  ('22222222-2222-2222-2222-222222222202', 'vendor', 22000),
  ('22222222-2222-2222-2222-222222222202', 'equipment', 6000),
  ('22222222-2222-2222-2222-222222222204', 'labor', 9000),
  ('22222222-2222-2222-2222-222222222204', 'vendor', 14000),
  ('22222222-2222-2222-2222-222222222204', 'equipment', 6000),
  ('22222222-2222-2222-2222-222222222206', 'labor', 5000),
  ('22222222-2222-2222-2222-222222222206', 'vendor', 6000),
  ('22222222-2222-2222-2222-222222222206', 'materials', 2000)
ON CONFLICT (contract_id, category) DO NOTHING;

-- Unprofitable mixer: ~38k costs vs 28k recognized revenue
INSERT INTO public.cost_entries (
  id, contract_id, entry_type, category, amount, vendor_name, invoice_ref,
  commitment_status, approval_status, is_reimbursable, notes, entered_by,
  incurred_date, flag_late_entry, flag_after_billing, flag_over_committed
) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccce101', '22222222-2222-2222-2222-222222222220', 'labor', 'labor', 8200, NULL, NULL,
   'actual', 'approved', false, 'Mixer staffing — overtime heavy (over budget)', 'seed', '2026-03-10', false, false, true),
  ('cccccccc-cccc-cccc-cccc-cccccccce102', '22222222-2222-2222-2222-222222222220', 'vendor_expense', 'vendor', 16500, 'Premier Catering Co', 'PC-MIX-88',
   'actual', 'approved', false, 'Catering actuals blew budget after guest-count surge', 'seed', '2026-03-14', false, false, true),
  ('cccccccc-cccc-cccc-cccc-cccccccce103', '22222222-2222-2222-2222-222222222220', 'vendor_expense', 'equipment', 7800, 'StageRight AV', 'SR-MIX-12',
   'actual', 'approved', false, 'Emergency AV upgrade day-of', 'seed', '2026-03-14', false, false, true),
  ('cccccccc-cccc-cccc-cccc-cccccccce104', '22222222-2222-2222-2222-222222222220', 'vendor_expense', 'materials', 3100, 'PrintWorks', 'PW-MIX-3',
   'actual', 'not_required', false, 'Reprint after branding change', 'seed', '2026-03-12', false, false, false),
  ('cccccccc-cccc-cccc-cccc-cccccccce105', '22222222-2222-2222-2222-222222222220', 'vendor_expense', 'vendor', 2400, 'Bloom & Branch Florals', 'BB-MIX-9',
   'actual', 'not_required', false, 'Cost entered after final invoice issued', 'seed', '2026-03-20', true, true, false),
  -- Autumn workshop (Oct 2025)
  ('cccccccc-cccc-cccc-cccc-cccccccce111', '22222222-2222-2222-2222-222222222221', 'labor', 'labor', 6400, NULL, NULL,
   'actual', 'approved', false, 'Workshop facilitation labor', 'seed', '2025-10-15', false, false, false),
  ('cccccccc-cccc-cccc-cccc-cccccccce112', '22222222-2222-2222-2222-222222222221', 'vendor_expense', 'vendor', 7200, 'Premier Catering Co', 'PC-WS-1',
   'actual', 'approved', false, 'Lunch service', 'seed', '2025-10-18', false, false, false),
  ('cccccccc-cccc-cccc-cccc-cccccccce113', '22222222-2222-2222-2222-222222222221', 'vendor_expense', 'equipment', 2800, 'StageRight AV', 'SR-WS-1',
   'actual', 'not_required', false, 'Classroom AV', 'seed', '2025-10-17', false, false, false),
  -- Winter dinner (Feb 2026)
  ('cccccccc-cccc-cccc-cccc-cccccccce121', '22222222-2222-2222-2222-222222222223', 'labor', 'labor', 5100, NULL, NULL,
   'actual', 'approved', false, 'Dinner service crew', 'seed', '2026-02-14', false, false, false),
  ('cccccccc-cccc-cccc-cccc-cccccccce122', '22222222-2222-2222-2222-222222222223', 'vendor_expense', 'vendor', 12800, 'Premier Catering Co', 'PC-WIN-1',
   'actual', 'approved', false, 'Plated dinner', 'seed', '2026-02-14', false, false, false),
  ('cccccccc-cccc-cccc-cccc-cccccccce123', '22222222-2222-2222-2222-222222222223', 'vendor_expense', 'equipment', 4200, 'BrightLight Rentals', 'BL-WIN-1',
   'actual', 'not_required', false, 'Ambient lighting', 'seed', '2026-02-13', false, false, false),
  -- Summer showcase (spread Jun–Aug)
  ('cccccccc-cccc-cccc-cccc-cccccccce131', '22222222-2222-2222-2222-222222222224', 'labor', 'labor', 4200, NULL, NULL,
   'actual', 'pending_approval', false, 'Showcase pre-build labor', 'seed', '2026-06-20', false, false, false),
  ('cccccccc-cccc-cccc-cccc-cccccccce132', '22222222-2222-2222-2222-222222222224', 'vendor_expense', 'vendor', 9800, 'Premier Catering Co', 'PC-SS-1',
   'committed', 'pending_approval', false, 'Reception catering commitment', 'seed', '2026-07-01', false, false, false),
  ('cccccccc-cccc-cccc-cccc-cccccccce133', '22222222-2222-2222-2222-222222222224', 'vendor_expense', 'equipment', 5500, 'StageRight AV', 'SR-SS-1',
   'actual', 'approved', false, 'Atrium AV package', 'seed', '2026-08-01', false, false, false),
  -- Vendor-tied costs for BrightStage / ClearStage narrative (Year-End Gala)
  ('cccccccc-cccc-cccc-cccc-cccccccce141', '22222222-2222-2222-2222-222222222202', 'vendor_expense', 'vendor', 6800, 'BrightStage AV', 'BS-YEG-INV-01',
   'actual', 'approved', false, 'Vendor invoice submitted — AV confirm + OT coverage', 'seed', '2026-08-12', false, false, false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6) Work / progress tracker: align Year-End Gala to Dec event; seed completed events
-- ---------------------------------------------------------------------------
UPDATE public.contract_deliverables SET
  scheduled_start = '2026-12-08 14:00:00+00',
  scheduled_end   = '2026-12-08 17:00:00+00'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc01';
UPDATE public.contract_deliverables SET
  scheduled_start = '2026-12-09 10:00:00+00',
  scheduled_end   = '2026-12-09 12:00:00+00'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc02';
UPDATE public.contract_deliverables SET
  scheduled_start = '2026-12-11 08:00:00+00',
  scheduled_end   = '2026-12-11 14:00:00+00'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
UPDATE public.contract_deliverables SET
  scheduled_start = '2026-12-12 16:00:00+00',
  scheduled_end   = '2026-12-12 23:00:00+00'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc04';
UPDATE public.contract_deliverables SET
  scheduled_start = '2026-12-13 00:30:00+00',
  scheduled_end   = '2026-12-13 04:00:00+00'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc05';

UPDATE public.work_assignments SET
  scheduled_start = d.scheduled_start,
  scheduled_end   = d.scheduled_end
FROM public.contract_deliverables d
WHERE work_assignments.deliverable_id = d.id
  AND d.contract_id = '22222222-2222-2222-2222-222222222202';

-- Mark vendor AV assignment as in progress with completion row pending
UPDATE public.work_assignments SET status = 'checked_in'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddd02';

INSERT INTO public.work_completions (
  id, assignment_id, performed_by_party_id, checked_in_at, completed_at, work_notes, completed_before_approval
) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10', 'dddddddd-dddd-dddd-dddd-dddddddddd02',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', '2026-12-09 10:05:00+00', NULL,
   'AV package confirmed on site; invoice BS-YEG-INV-01 submitted to MainEvent AP.', false)
ON CONFLICT (id) DO NOTHING;

-- Historical completed work for Physician Conference + Anderson Wedding + Spring Mixer
INSERT INTO public.contract_deliverables (
  id, contract_id, code, title, description, phase, location, scheduled_start, scheduled_end, status, sort_order
) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc31', '22222222-2222-2222-2222-222222222203', 'PHY-EXEC-SHOW', 'Conference show call',
   'Live CME sessions through closing remarks', 'execution', 'Harborview Convention Center',
   '2025-11-03 07:00:00+00', '2025-11-05 17:00:00+00', 'completed', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccc32', '22222222-2222-2222-2222-222222222203', 'PHY-WRAP-REC', 'Recording package delivery',
   'CME recording deliverable (CO-001)', 'wrapup', 'Remote',
   '2025-12-10 09:00:00+00', '2025-12-10 17:00:00+00', 'completed', 2),
  ('cccccccc-cccc-cccc-cccc-cccccccccc41', '22222222-2222-2222-2222-222222222205', 'WED-EXEC-CER', 'Ceremony & reception',
   'Full wedding weekend execution', 'execution', 'Cedar Estate',
   '2026-01-10 14:00:00+00', '2026-01-12 01:00:00+00', 'completed', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccc51', '22222222-2222-2222-2222-222222222220', 'MIX-EXEC', 'Mixer execution',
   'Spring mixer doors-to-strike', 'execution', 'Prairie Hall',
   '2026-03-14 16:00:00+00', '2026-03-15 01:00:00+00', 'completed', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccc61', '22222222-2222-2222-2222-222222222201', 'Q3-EXEC', 'Summit delivery',
   'Leadership summit show call', 'execution', 'Grand Meridian',
   '2025-09-12 08:00:00+00', '2025-09-14 18:00:00+00', 'completed', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccc71', '22222222-2222-2222-2222-222222222224', 'SS-PLAN', 'Showcase floor plan',
   'Confirm atrium layout', 'planning', 'Harborview Atrium',
   '2026-07-15 10:00:00+00', '2026-07-15 12:00:00+00', 'completed', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccc72', '22222222-2222-2222-2222-222222222224', 'SS-EXEC', 'Showcase load-in',
   'Load-in and rehearsal', 'execution', 'Harborview Atrium',
   '2026-08-21 08:00:00+00', '2026-08-21 18:00:00+00', 'scheduled', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.work_assignments (
  id, contract_id, deliverable_id, assignee_party_id, title, instructions, location,
  scheduled_start, scheduled_end, status
) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd31', '22222222-2222-2222-2222-222222222203',
   'cccccccc-cccc-cccc-cccc-cccccccccc31', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
   'Run conference show call', 'Cue sheet through closing', 'Harborview CC',
   '2025-11-03 07:00:00+00', '2025-11-05 17:00:00+00', 'completed'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd41', '22222222-2222-2222-2222-222222222205',
   'cccccccc-cccc-cccc-cccc-cccccccccc41', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05',
   'Floral & ceremony install', 'Per wedding rider', 'Cedar Estate',
   '2026-01-10 10:00:00+00', '2026-01-10 16:00:00+00', 'completed'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd51', '22222222-2222-2222-2222-222222222220',
   'cccccccc-cccc-cccc-cccc-cccccccccc51', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
   'Mixer floor lead', 'Overtime authorized', 'Prairie Hall',
   '2026-03-14 16:00:00+00', '2026-03-15 01:00:00+00', 'completed'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd71', '22222222-2222-2222-2222-222222222224',
   'cccccccc-cccc-cccc-cccc-cccccccccc72', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
   'Showcase AV load-in', 'Vendor BrightStage package', 'Harborview Atrium',
   '2026-08-21 08:00:00+00', '2026-08-21 18:00:00+00', 'scheduled')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.work_completions (
  id, assignment_id, performed_by_party_id, checked_in_at, completed_at, work_notes, completed_before_approval
) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee31', 'dddddddd-dddd-dddd-dddd-dddddddddd31',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '2025-11-03 06:50:00+00', '2025-11-05 17:10:00+00',
   'Conference delivered; CME recording queued for CO package.', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee41', 'dddddddd-dddd-dddd-dddd-dddddddddd41',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', '2026-01-10 09:55:00+00', '2026-01-10 15:40:00+00',
   'Ceremony florals complete.', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee51', 'dddddddd-dddd-dddd-dddd-dddddddddd51',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '2026-03-14 15:50:00+00', '2026-03-15 01:05:00+00',
   'Mixer complete; guest count overrun drove catering OT.', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7) Deposits for new active / completed demos
-- ---------------------------------------------------------------------------
INSERT INTO public.deposits (id, contract_id, customer_id, amount, received_at, status, applied_to_invoice_id) VALUES
  ('44444444-4444-4444-4444-444444444420', '22222222-2222-2222-2222-222222222220', '11111111-1111-1111-1111-111111111106',
   7000, '2026-02-05', 'applied', '33333333-3333-3333-3333-333333333320'),
  ('44444444-4444-4444-4444-444444444421', '22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111102',
   20100, '2026-05-10', 'unearned', NULL),
  ('44444444-4444-4444-4444-444444444423', '22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111101',
   20800, '2025-12-20', 'applied', '33333333-3333-3333-3333-333333333325')
ON CONFLICT (id) DO NOTHING;

UPDATE public.contracts SET
  status = 'active',
  activated_at = COALESCE(activated_at, '2026-05-11 12:00:00+00')
WHERE id = '22222222-2222-2222-2222-222222222224';
