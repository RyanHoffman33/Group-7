-- ============================================================================
-- DEMO SEED REFRESH (showcase) — Demo Customer pipeline, POs, AR, engagement
-- Project: ACCY628-FINAL-PROJECT (eslwjydxevrdgeiqkwtq)
-- Requires: 20260807090000_demo_seed_refresh_core.sql applied first
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Showcase contracts (Demo Customer + narrative edge cases)
-- ---------------------------------------------------------------------------
INSERT INTO public.contracts (
  id, customer_id, contract_number, event_name, contract_value, original_contract_value,
  deposit_required, deposit_percent, minimum_deposit_amount, status, performance_complete,
  approved_at, approved_by, billing_method, event_type, event_start, event_end,
  venue_name, venue_city, guest_count, project_manager_label, involvement_model,
  currency, activated_at, terms_locked_at, cancellation_fee_percent, notes, progress_percent,
  canceled_at, cancel_reason, canceled_by
) VALUES
-- Leadership Conference — ASC 606 PO demo
(
  '22222222-2222-2222-2222-222222222230',
  '11111111-1111-1111-1111-111111111108',
  'ME-2026-222222222230',
  'Demo Customer Leadership Conference',
  50000, 50000, true, 30, 15000, 'active', false,
  '2026-06-01', 'Alex Rivera', 'fixed_price', 'corporate_conference',
  '2026-09-18 09:00:00+00', '2026-09-19 17:00:00+00',
  'Grand Ballroom East', 'Chicago', 180, 'Alex Rivera', 'collaborative',
  'USD', '2026-06-05', '2026-06-01', 30,
  'Demo seed — portal + PO installment walkthrough.', 35,
  NULL, NULL, NULL
),
-- Holiday Reception
(
  '22222222-2222-2222-2222-222222222231',
  '11111111-1111-1111-1111-111111111108',
  'ME-2026-222222222231',
  'Demo Customer Holiday Reception',
  22000, 22000, true, 31.82, 7000, 'active', false,
  '2026-07-10', 'Alex Rivera', 'fixed_price', 'holiday_party',
  '2026-12-12 18:00:00+00', '2026-12-12 22:00:00+00',
  'Skyline Terrace', 'Chicago', 90, 'Alex Rivera', 'collaborative',
  'USD', '2026-07-15', '2026-07-10', 31.82,
  'Demo seed — second PO package.', 20,
  NULL, NULL, NULL
),
-- Spring workshop (involvement checkpoints)
(
  '22222222-2222-2222-2222-222222222232',
  '11111111-1111-1111-1111-111111111108',
  'ME-2026-222222222232',
  'Demo Customer Spring Client Workshop',
  18000, 18000, true, 25, 4500, 'active', false,
  '2026-03-01', 'Emily Gray', 'fixed_price', 'corporate_event',
  '2026-04-22 09:00:00+00', '2026-04-22 16:00:00+00',
  'Innovation Lab', 'Chicago', 60, 'Emily Gray', 'custom',
  'USD', '2026-03-05', '2026-03-01', 25,
  'Demo seed — customer involvement checkpoints.', 55,
  NULL, NULL, NULL
),
-- Final Presentation (canonical fixed UUID replacing runtime id)
(
  '22222222-2222-2222-2222-222222222238',
  '11111111-1111-1111-1111-111111111108',
  'ME-2026-222222222238',
  'Final Presentation',
  35000, 35000, true, 30, 10500, 'active', false,
  '2026-07-20', 'Morgan Ellis', 'fixed_price', 'corporate_conference',
  '2026-08-20 10:00:00+00', '2026-08-20 16:00:00+00',
  'MainEvent Studio A', 'Chicago', 75, 'Morgan Ellis', 'full_service',
  'USD', '2026-07-22', '2026-07-20', 30,
  'Demo seed — live walkthrough event.', 40,
  NULL, NULL, NULL
),
-- Cancellation with forfeited deposit recognized
-- contracts_cancel_docs_check requires cancel_reason + canceled_at when status=canceled
(
  '22222222-2222-2222-2222-000000003100',
  '11111111-1111-1111-1111-111111111113',
  'ME-2025-000000003100',
  'Cascade Brand Summit (Canceled)',
  75000, 75000, true, 40, 30000, 'canceled', false,
  '2025-06-01', 'Sam Okonkwo', 'fixed_price', 'corporate_conference',
  '2025-09-20 09:00:00+00', '2025-09-21 17:00:00+00',
  'Cascade HQ Campus', 'Portland', 300, 'Sam Okonkwo', 'collaborative',
  'USD', '2025-06-05', '2025-06-01', 40,
  'Cancellation fee / deposit forfeit demo for profitability + GAAP.', 10,
  '2025-08-01 16:00:00+00', 'Client reorg — event withdrawn 50 days out', 'Sam Okonkwo'
),
-- Unprofitable completed (negative margin exception)
(
  '22222222-2222-2222-2222-222222222220',
  '11111111-1111-1111-1111-111111111106',
  'ME-2026-222222222220',
  'Spring Mixer — Margin Loss Demo',
  28000, 28000, true, 25, NULL, 'completed', true,
  '2026-01-20', 'Morgan Ellis', 'fixed_price', 'fundraiser',
  '2026-03-14 18:00:00+00', '2026-03-14 23:00:00+00',
  'Prairie Hall', 'Des Moines', 180, 'Morgan Ellis', 'full_service',
  'USD', '2026-01-25', '2026-01-20', 25,
  'Completed; costs exceeded recognized revenue (unprofitable demo).', 100,
  NULL, NULL, NULL
),
-- Active summer showcase with draft/void invoices
(
  '22222222-2222-2222-2222-222222222224',
  '11111111-1111-1111-1111-111111111102',
  'ME-2026-222222222224',
  'Summit Summer Showcase',
  64000, 64000, true, 30, 19200, 'active', false,
  '2026-05-01', 'Jordan Blake', 'progress', 'product_launch',
  '2026-08-28 10:00:00+00', '2026-08-28 20:00:00+00',
  'Summit Arena', 'Austin', 250, 'Jordan Blake', 'collaborative',
  'USD', '2026-05-10', '2026-05-01', 30,
  'Demo seed — draft/void invoice status coverage.', 45,
  NULL, NULL, NULL
),
-- Open AR / aging demo (Harborview)
-- contract_number ME-2026-222222222225 already taken by unrelated row; use HV-specific number
(
  '22222222-2222-2222-2222-222222222225',
  '11111111-1111-1111-1111-111111111103',
  'ME-2026-HV-222222222225',
  'Harborview Physician Gala',
  42000, 42000, true, 25, 10500, 'active', false,
  '2026-02-15', 'Emily Gray', 'milestone', 'gala',
  '2026-06-20 18:00:00+00', '2026-06-20 23:00:00+00',
  'Harborview Pavilion', 'Seattle', 200, 'Emily Gray', 'collaborative',
  'USD', '2026-02-20', '2026-02-15', 25,
  'Demo seed — open AR / disputed invoice.', 80,
  NULL, NULL, NULL
)
ON CONFLICT (id) DO UPDATE SET
  event_name = EXCLUDED.event_name,
  contract_number = EXCLUDED.contract_number,
  contract_value = EXCLUDED.contract_value,
  status = EXCLUDED.status,
  deposit_percent = EXCLUDED.deposit_percent,
  minimum_deposit_amount = EXCLUDED.minimum_deposit_amount,
  notes = EXCLUDED.notes,
  canceled_at = EXCLUDED.canceled_at,
  cancel_reason = EXCLUDED.cancel_reason,
  canceled_by = EXCLUDED.canceled_by;

UPDATE public.contracts
SET canceled_at = '2025-08-01 16:00:00+00',
    cancel_reason = 'Client reorg — event withdrawn 50 days out',
    canceled_by = 'Sam Okonkwo',
    completed_at = '2026-03-15 01:00:00+00'
WHERE id = '22222222-2222-2222-2222-000000003100';

UPDATE public.contracts
SET completed_at = '2026-03-15 01:00:00+00'
WHERE id = '22222222-2222-2222-2222-222222222220';

-- ---------------------------------------------------------------------------
-- 2) ASC 606 performance obligations + installment deposits (Demo Customer)
-- ---------------------------------------------------------------------------
INSERT INTO public.contract_performance_obligations (
  id, contract_id, seq, title, description, completion_definition, amount, status,
  ready_for_approval_at, ready_for_approval_by, service_keys, created_at, updated_at
) VALUES
(
  'a0606001-0001-4000-8000-000000000001',
  '22222222-2222-2222-2222-222222222230', 1,
  'Event planning & design package',
  'Concept, floor plan, vendor shortlist, and run-of-show draft.',
  'Customer signs off that planning package is complete and ready for production.',
  15000.00, 'awaiting_approval', now() - interval '2 days', 'Alex Rivera',
  ARRAY['svc-0'], now() - interval '14 days', now()
),
(
  'a0606001-0001-4000-8000-000000000002',
  '22222222-2222-2222-2222-222222222230', 2,
  'On-site production & staffing',
  'Full event-day production, AV, and crew.',
  'Customer confirms event-day delivery matched the approved run-of-show.',
  25000.00, 'active', NULL, NULL, ARRAY['svc-1'], now() - interval '14 days', now()
),
(
  'a0606001-0001-4000-8000-000000000003',
  '22222222-2222-2222-2222-222222222230', 3,
  'Post-event wrap-up & reporting',
  'Teardown, vendor reconciliation, and post-event report.',
  'Customer accepts final wrap-up report and closes the engagement.',
  10000.00, 'active', NULL, NULL, ARRAY['svc-2'], now() - interval '14 days', now()
),
(
  'a0606001-0001-4000-8000-000000000011',
  '22222222-2222-2222-2222-222222222231', 1,
  'Creative design & décor plan',
  'Theme, décor board, and guest experience plan.',
  'Customer approves creative package as complete.',
  7000.00, 'awaiting_approval', now() - interval '1 day', 'Alex Rivera',
  ARRAY['svc-0'], now() - interval '10 days', now()
),
(
  'a0606001-0001-4000-8000-000000000012',
  '22222222-2222-2222-2222-222222222231', 2,
  'Reception production day',
  'Venue setup, catering coordination, and hosting.',
  'Customer confirms reception day performance was satisfactory.',
  12000.00, 'active', NULL, NULL, ARRAY['svc-1'], now() - interval '10 days', now()
),
(
  'a0606001-0001-4000-8000-000000000013',
  '22222222-2222-2222-2222-222222222231', 3,
  'Strike & guest follow-up',
  'Strike, inventory return, and thank-you package.',
  'Customer accepts strike completion and closes the reception engagement.',
  3000.00, 'active', NULL, NULL, ARRAY['svc-2'], now() - interval '10 days', now()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, amount = EXCLUDED.amount, status = EXCLUDED.status,
  ready_for_approval_at = EXCLUDED.ready_for_approval_at, service_keys = EXCLUDED.service_keys,
  updated_at = now();

INSERT INTO public.deposits (
  id, contract_id, customer_id, amount, received_at, status, performance_obligation_id
) VALUES
(
  'd0606001-0001-4000-8000-000000000001',
  '22222222-2222-2222-2222-222222222230',
  '11111111-1111-1111-1111-111111111108',
  15000.00, CURRENT_DATE - 10, 'unearned',
  'a0606001-0001-4000-8000-000000000001'
),
(
  'd0606001-0001-4000-8000-000000000011',
  '22222222-2222-2222-2222-222222222231',
  '11111111-1111-1111-1111-111111111108',
  7000.00, CURRENT_DATE - 7, 'unearned',
  'a0606001-0001-4000-8000-000000000011'
),
(
  'd0606001-0001-4000-8000-000000000038',
  '22222222-2222-2222-2222-222222222238',
  '11111111-1111-1111-1111-111111111108',
  10500.00, CURRENT_DATE - 5, 'unearned', NULL
)
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount, status = EXCLUDED.status,
  performance_obligation_id = EXCLUDED.performance_obligation_id;

UPDATE public.contract_performance_obligations
SET installment_deposit_id = 'd0606001-0001-4000-8000-000000000001', updated_at = now()
WHERE id = 'a0606001-0001-4000-8000-000000000001';
UPDATE public.contract_performance_obligations
SET installment_deposit_id = 'd0606001-0001-4000-8000-000000000011', updated_at = now()
WHERE id = 'a0606001-0001-4000-8000-000000000011';

-- Involvement checkpoints on Spring Workshop
INSERT INTO public.contract_involvement_checkpoints (
  id, contract_id, checkpoint_type, required
) VALUES
  ('a1000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222232', 'venue', true),
  ('a1000000-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222232', 'budget', true),
  ('a1000000-0000-4000-8000-000000000003', '22222222-2222-2222-2222-222222222232', 'final_run_of_show', true),
  ('a1000000-0000-4000-8000-000000000004', '22222222-2222-2222-2222-222222222232', 'change_order', true),
  ('a1000000-0000-4000-8000-000000000005', '22222222-2222-2222-2222-222222222232', 'cancellation', true)
ON CONFLICT (contract_id, checkpoint_type) DO UPDATE SET required = EXCLUDED.required;

INSERT INTO public.customer_approval_items (
  id, contract_id, checkpoint_type, title, item_key, version,
  supporting_info, due_date, status, created_by, sent_at
) VALUES
(
  'b1000000-0000-4000-8000-000000000030',
  '22222222-2222-2222-2222-222222222230',
  'major_vendors', 'Approve primary AV + catering vendors', 'vendors-primary', 1,
  'StageRight AV and Premier Catering proposed as principal vendors.',
  '2026-08-15', 'pending', 'Emily Gray', now()
),
(
  'b1000000-0000-4000-8000-000000000031',
  '22222222-2222-2222-2222-222222222230',
  'final_run_of_show', 'Approve final run-of-show (day 1–2)', 'run-of-show-v1', 1,
  'Two-day leadership agenda with breakouts.',
  '2026-09-01', 'pending', 'Alex Rivera', now()
)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status;

-- ---------------------------------------------------------------------------
-- 3) Cancellation fee invoice (Cascade) + loss-demo invoice + open AR
-- ---------------------------------------------------------------------------
INSERT INTO public.invoices (
  id, contract_id, customer_id, invoice_number, issue_date, due_date,
  subtotal, tax, total, status, recognition_status, milestone_key, created_by, status_note
) VALUES
(
  '33333333-3333-3333-3333-000000004100',
  '22222222-2222-2222-2222-000000003100',
  '11111111-1111-1111-1111-111111111113',
  'INV-HIST-4100', '2025-08-02', '2025-09-01',
  30000, 0, 30000, 'paid', 'recognized', 'cancel-fee', 'seed-demo',
  'Cancellation fee = 40% of CV; deposit applied'
),
(
  '33333333-3333-3333-3333-000000004200',
  '22222222-2222-2222-2222-222222222220',
  '11111111-1111-1111-1111-111111111106',
  'INV-2026-LOSS-01', '2026-03-10', '2026-04-09',
  28000, 0, 28000, 'paid', 'recognized', 'loss-final', 'seed-demo',
  'Fully recognized loss-demo event'
),
(
  '33333333-3333-3333-3333-000000004225',
  '22222222-2222-2222-2222-222222222225',
  '11111111-1111-1111-1111-111111111103',
  'INV-2026-HV-01', '2026-05-01', '2026-05-31',
  21000, 0, 21000, 'unpaid', 'recognized', 'gala-milestone-1', 'seed-demo',
  'Open AR — aging demo'
),
(
  '33333333-3333-3333-3333-000000004226',
  '22222222-2222-2222-2222-222222222225',
  '11111111-1111-1111-1111-111111111103',
  'INV-2026-HV-02', '2026-06-15', '2026-07-15',
  12000, 0, 12000, 'disputed', 'deferred', 'gala-milestone-2', 'seed-demo',
  'Customer disputed AV change-order line'
),
(
  '33333333-3333-3333-3333-000000004101',
  '22222222-2222-2222-2222-222222222224',
  '11111111-1111-1111-1111-111111111102',
  'INV-2026-DRAFT-01', CURRENT_DATE, CURRENT_DATE + 30,
  8000, 0, 8000, 'draft', 'deferred', 'showcase-draft', 'seed-demo',
  'Draft progress bill — not yet issued'
),
(
  '33333333-3333-3333-3333-000000004102',
  '22222222-2222-2222-2222-222222222224',
  '11111111-1111-1111-1111-111111111102',
  'INV-2026-VOID-01', CURRENT_DATE - 20, CURRENT_DATE + 10,
  5000, 0, 5000, 'void', 'deferred', 'showcase-void', 'seed-demo',
  'Voided duplicate draft'
),
(
  '33333333-3333-3333-3333-000000004224',
  '22222222-2222-2222-2222-222222222224',
  '11111111-1111-1111-1111-111111111102',
  'INV-2026-SHOW-01', '2026-07-01', '2026-07-31',
  19200, 0, 19200, 'partially_paid', 'recognized', 'showcase-deposit-bill', 'seed-demo',
  'Deposit invoice — partially collected'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status, recognition_status = EXCLUDED.recognition_status,
  total = EXCLUDED.total, status_note = EXCLUDED.status_note;

UPDATE public.invoices SET voided_at = COALESCE(voided_at, now())
WHERE id = '33333333-3333-3333-3333-000000004102';

INSERT INTO public.invoice_lines (invoice_id, description, amount, performance_obligation_ref, line_type)
SELECT v.invoice_id, v.description, v.amount, v.po_ref, v.line_type
FROM (VALUES
  ('33333333-3333-3333-3333-000000004100'::uuid, 'Cancellation fee (40% of contract value)', 30000::numeric, 'PO-cancel', 'fixed'),
  ('33333333-3333-3333-3333-000000004200', 'Spring Mixer full settlement', 28000, 'PO-event', 'fixed'),
  ('33333333-3333-3333-3333-000000004225', 'Physician Gala — milestone 1 (venue + design)', 21000, 'PO-m1', 'fixed'),
  ('33333333-3333-3333-3333-000000004226', 'Physician Gala — milestone 2 (AV change order)', 12000, 'PO-m2', 'fixed'),
  ('33333333-3333-3333-3333-000000004101', 'Draft — atrium build progress', 8000, NULL, 'progress'),
  ('33333333-3333-3333-3333-000000004102', 'Voided duplicate progress bill', 5000, NULL, 'progress'),
  ('33333333-3333-3333-3333-000000004224', 'Summer Showcase deposit / progress', 19200, 'PO-dep', 'fixed')
) AS v(invoice_id, description, amount, po_ref, line_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_lines il
  WHERE il.invoice_id = v.invoice_id AND il.description = v.description
);

INSERT INTO public.recognition_evidence (
  id, contract_id, invoice_id, evidence_type, evidence_date, description, supporting_ref, created_by
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-000000004100',
  '22222222-2222-2222-2222-000000003100',
  '33333333-3333-3333-3333-000000004100',
  'other', '2025-08-01',
  'Cancellation executed; deposit forfeited per policy and recognized as fee',
  'DOC-CANCEL-CASCADE-3100', 'seed-demo'
),
(
  'aaaaaaaa-aaaa-aaaa-aaaa-000000004200',
  '22222222-2222-2222-2222-222222222220',
  '33333333-3333-3333-3333-000000004200',
  'event_completion', '2026-03-14',
  'Spring Mixer completed (loss demo)',
  'DOC-LOSS-220', 'seed-demo'
),
(
  'aaaaaaaa-aaaa-aaaa-aaaa-000000004225',
  '22222222-2222-2222-2222-222222222225',
  '33333333-3333-3333-3333-000000004225',
  'milestone_signoff', '2026-05-01',
  'Milestone 1 accepted; invoice recognized, payment outstanding',
  'DOC-HV-M1', 'seed-demo'
),
(
  'aaaaaaaa-aaaa-aaaa-aaaa-000000004224',
  '22222222-2222-2222-2222-222222222224',
  '33333333-3333-3333-3333-000000004224',
  'other', '2026-07-01',
  'Progress bill recognized on deposit invoice',
  'DOC-SHOW-01', 'seed-demo'
)
ON CONFLICT (id) DO UPDATE SET evidence_date = EXCLUDED.evidence_date;

INSERT INTO public.deposits (
  id, contract_id, customer_id, amount, received_at, status, applied_to_invoice_id
) VALUES (
  '44444444-4444-4444-4444-000000004100',
  '22222222-2222-2222-2222-000000003100',
  '11111111-1111-1111-1111-111111111113',
  30000, '2025-06-10', 'applied', '33333333-3333-3333-3333-000000004100'
)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, applied_to_invoice_id = EXCLUDED.applied_to_invoice_id;

INSERT INTO public.payments (id, customer_id, amount, paid_at, method, reference) VALUES
  ('55555555-5555-5555-5555-000000004100', '11111111-1111-1111-1111-111111111113', 30000, '2025-06-10', 'ach', 'CASCADE-DEP-FORFEIT'),
  ('55555555-5555-5555-5555-000000004200', '11111111-1111-1111-1111-111111111106', 28000, '2026-03-20', 'wire', 'DEMO-LOSS-PMT'),
  ('55555555-5555-5555-5555-000000004224', '11111111-1111-1111-1111-111111111102', 10000, '2026-07-08', 'ach', 'DEMO-SHOW-PARTIAL')
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount;

INSERT INTO public.payment_applications (payment_id, invoice_id, amount)
SELECT * FROM (VALUES
  ('55555555-5555-5555-5555-000000004100'::uuid, '33333333-3333-3333-3333-000000004100'::uuid, 30000::numeric),
  ('55555555-5555-5555-5555-000000004200', '33333333-3333-3333-3333-000000004200', 28000),
  ('55555555-5555-5555-5555-000000004224', '33333333-3333-3333-3333-000000004224', 10000)
) AS v(payment_id, invoice_id, amount)
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_applications pa
  WHERE pa.payment_id = v.payment_id AND pa.invoice_id = v.invoice_id
);

INSERT INTO public.billing_alerts (
  id, invoice_id, customer_id, from_bucket, to_bucket, outstanding_amount, channel
) VALUES (
  'f1000000-0000-4000-8000-000000000001',
  '33333333-3333-3333-3333-000000004225',
  '11111111-1111-1111-1111-111111111103',
  '61-90', '90+', 21000, 'in_app'
)
ON CONFLICT (id) DO UPDATE SET outstanding_amount = EXCLUDED.outstanding_amount;

INSERT INTO public.ar_bucket_state (invoice_id, current_bucket, outstanding_amount, updated_at)
VALUES
  ('33333333-3333-3333-3333-000000004225', '90+', 21000, now()),
  ('33333333-3333-3333-3333-000000004224', '1-30', 9200, now())
ON CONFLICT (invoice_id) DO UPDATE SET
  current_bucket = EXCLUDED.current_bucket,
  outstanding_amount = EXCLUDED.outstanding_amount,
  updated_at = now();

-- Costs for loss demo + cancel + showcase
INSERT INTO public.cost_budgets (contract_id, category, budgeted_amount) VALUES
  ('22222222-2222-2222-2222-222222222220', 'labor', 8000),
  ('22222222-2222-2222-2222-222222222220', 'vendor', 12000),
  ('22222222-2222-2222-2222-222222222220', 'equipment', 4000),
  ('22222222-2222-2222-2222-000000003100', 'vendor', 5000),
  ('22222222-2222-2222-2222-222222222224', 'labor', 15000),
  ('22222222-2222-2222-2222-222222222224', 'vendor', 20000),
  ('22222222-2222-2222-2222-222222222225', 'labor', 10000),
  ('22222222-2222-2222-2222-222222222225', 'vendor', 16000)
ON CONFLICT (contract_id, category) DO UPDATE SET budgeted_amount = EXCLUDED.budgeted_amount;

INSERT INTO public.cost_entries (
  id, contract_id, entry_type, category, amount, vendor_id, vendor_name, invoice_ref,
  commitment_status, approval_status, is_reimbursable, notes, entered_by, incurred_date,
  flag_late_entry, flag_over_committed
) VALUES
(
  'cccccccc-cccc-cccc-cccc-00000000d100',
  '22222222-2222-2222-2222-000000003100',
  'vendor_expense', 'vendor', 4200,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'StageRight AV', 'BS-CANCEL-HOLD',
  'actual', 'approved', false,
  'Non-refundable venue/AV hold costs before cancellation', 'seed-demo', '2025-07-15',
  false, false
),
(
  'cccccccc-cccc-cccc-cccc-00000000d220',
  '22222222-2222-2222-2222-222222222220',
  'vendor_expense', 'vendor', 18500,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Premier Catering Co', 'LOSS-V-220',
  'actual', 'approved', false, 'Catering overrun on loss demo', 'seed-demo', '2026-03-14',
  false, true
),
(
  'cccccccc-cccc-cccc-cccc-00000000d221',
  '22222222-2222-2222-2222-222222222220',
  'labor', 'labor', 9800,
  NULL, NULL, NULL,
  'actual', 'approved', false, 'Extra staffing on loss demo', 'seed-demo', '2026-03-14',
  true, false
),
(
  'cccccccc-cccc-cccc-cccc-00000000d222',
  '22222222-2222-2222-2222-222222222220',
  'vendor_expense', 'equipment', 5200,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'BrightLight Rentals', 'LOSS-E-220',
  'actual', 'approved', false, 'Lighting package', 'seed-demo', '2026-03-14',
  false, false
),
(
  'cccccccc-cccc-cccc-cccc-00000000d224',
  '22222222-2222-2222-2222-222222222224',
  'vendor_expense', 'vendor', 12500,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Premier Catering Co', 'SHOW-V-224',
  'actual', 'approved', false, 'Showcase catering committed/actual', 'seed-demo', '2026-07-15',
  false, false
),
(
  'cccccccc-cccc-cccc-cccc-00000000d225',
  '22222222-2222-2222-2222-222222222225',
  'vendor_expense', 'vendor', 9800,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'SoundWave Production', 'HV-V-225',
  'actual', 'approved', false, 'Gala production costs', 'seed-demo', '2026-06-18',
  false, false
)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, vendor_id = EXCLUDED.vendor_id;

INSERT INTO public.cost_flag_cases (id, cost_entry_id, flag_key, status)
VALUES
  ('f1000000-0000-4000-8000-000000000110', 'cccccccc-cccc-cccc-cccc-00000000d220', 'flag_over_committed', 'open'),
  ('f1000000-0000-4000-8000-000000000111', 'cccccccc-cccc-cccc-cccc-00000000d221', 'flag_late_entry', 'open')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- ---------------------------------------------------------------------------
-- 4) Engagement workflow (Demo Customer portal)
-- ---------------------------------------------------------------------------
INSERT INTO public.engagement_inquiries (
  id, customer_id, customer_user_email, organization, contact_name, contact_email,
  contact_phone, event_name, event_type, preferred_start, preferred_end, location,
  guest_count, budget_range, description, status, created_at, updated_at,
  approved_by, approved_at
) VALUES
(
  'e1111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111108',
  'customer@gmail.com', 'Demo Customer', 'Casey Customer', 'customer@gmail.com', '555-0108',
  'Demo Customer Spring Leadership Summit', 'corporate_conference',
  '2026-09-18', '2026-09-19', 'Chicago, IL — downtown hotel ballroom', 180,
  '$75,000 – $150,000',
  'Two-day leadership summit with AV, catering, and breakout rooms. Awaiting exec/PM approval and company quote.',
  'pending_approval', now() - interval '2 days', now() - interval '2 days', NULL, NULL
),
(
  'e1111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111108',
  'customer@gmail.com', 'Demo Customer', 'Casey Customer', 'customer@gmail.com', '555-0108',
  'Demo Customer Client Appreciation Gala', 'gala',
  '2026-10-24', '2026-10-24', 'Chicago, IL — lakefront venue', 220,
  '$75,000 – $150,000',
  'Evening gala — quote denied once; amend path available.',
  'quote_denied', now() - interval '5 days', now() - interval '1 day',
  'manager@gmail.com', now() - interval '1 day'
),
(
  'e1111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111108',
  'customer@gmail.com', 'Demo Customer', 'Casey Customer', 'customer@gmail.com', '555-0108',
  'Demo Customer Product Launch Night', 'product_launch',
  '2026-11-12', '2026-11-12', 'Chicago, IL — riverfront loft', 140,
  '$25,000 – $75,000',
  'Accepted preliminary quote; deposit recorded; vendor offer sent.',
  'vendor_offer_sent', now() - interval '14 days', now() - interval '1 day',
  'executive@gmail.com', now() - interval '12 days'
)
ON CONFLICT (id) DO UPDATE SET
  organization = EXCLUDED.organization, event_name = EXCLUDED.event_name,
  status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;

INSERT INTO public.company_quotes (
  id, inquiry_id, version, amount, line_items, notes, valid_until, status, created_by, submitted_at
) VALUES
(
  'e2222222-2222-2222-2222-222222222201',
  'e1111111-1111-1111-1111-111111111102', 1, 96000.00,
  '[{"description":"Venue coordination & staffing","amount":32000},{"description":"Catering & beverage package","amount":38000},{"description":"AV / lighting / entertainment","amount":26000}]'::jsonb,
  'Preliminary company quote for the Client Appreciation Gala. Deposit due on acceptance: 25%.',
  '2026-09-30', 'denied', 'manager@gmail.com', now() - interval '1 day'
),
(
  'e2222222-2222-2222-2222-222222222202',
  'e1111111-1111-1111-1111-111111111103', 1, 52000.00,
  '[{"description":"Event production package","amount":52000}]'::jsonb,
  'Accepted preliminary estimate for Product Launch Night.',
  '2026-10-15', 'accepted', 'manager@gmail.com', now() - interval '10 days'
)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, amount = EXCLUDED.amount;

INSERT INTO public.contracts (
  id, customer_id, contract_number, event_name, event_type, event_start, event_end,
  venue_name, venue_city, guest_count, project_manager_label, billing_method,
  contract_value, original_contract_value, change_order_value_total,
  deposit_required, deposit_percent, minimum_deposit_amount, requires_deposit_before_work,
  cancellation_fee_percent, status, performance_complete, involvement_model, notes,
  approved_at, approved_by, activated_at, currency
) VALUES (
  'e3333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111108',
  'ME-ENG-9001',
  'Demo Customer Product Launch Night',
  'product_launch',
  '2026-11-12T18:00:00+00', '2026-11-12T23:00:00+00',
  'Riverfront Loft', 'Chicago', 140, 'Morgan Manager', 'fixed_price',
  52000, 52000, 0, true, 25, 13000, true, 50,
  'active', false, 'collaborative',
  'Created from engagement inquiry acceptance (demo seed).',
  now() - interval '10 days', 'executive@gmail.com', now() - interval '9 days', 'USD'
)
ON CONFLICT (id) DO UPDATE SET
  event_name = EXCLUDED.event_name, contract_value = EXCLUDED.contract_value, status = EXCLUDED.status;

INSERT INTO public.deposits (id, contract_id, customer_id, amount, received_at, status)
VALUES (
  'e4444444-4444-4444-4444-444444444401',
  'e3333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111108',
  13000, (now() - interval '9 days')::date, 'unearned'
)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status;

UPDATE public.engagement_inquiries
SET contract_id = 'e3333333-3333-3333-3333-333333333301',
    deposit_id = 'e4444444-4444-4444-4444-444444444401'
WHERE id = 'e1111111-1111-1111-1111-111111111103';

INSERT INTO public.engagement_signatures (
  id, inquiry_id, related_quote_id, signature_type, signer_name, signer_email,
  signed_at, ip_address, user_agent
) VALUES (
  'e5555555-5555-5555-5555-555555555501',
  'e1111111-1111-1111-1111-111111111103',
  'e2222222-2222-2222-2222-222222222202',
  'preliminary_contract', 'Casey Customer', 'customer@gmail.com',
  now() - interval '10 days', '127.0.0.1', 'MainEvent-Demo/1.0'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vendor_rfqs (id, inquiry_id, vendor_id, title, message, status, sent_by, sent_at) VALUES
(
  'e6666666-6666-6666-6666-666666666601',
  'e1111111-1111-1111-1111-111111111103',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'Catering RFQ — Demo Customer Product Launch',
  'Please quote plated dinner + beverage for 140 guests at the riverfront loft on 2026-11-12.',
  'quoted', 'manager@gmail.com', now() - interval '4 days'
),
(
  'e6666666-6666-6666-6666-666666666602',
  'e1111111-1111-1111-1111-111111111103',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'AV RFQ — Demo Customer Product Launch',
  'Need stage AV, screens, and lighting for a 90-minute product reveal.',
  'sent', 'manager@gmail.com', now() - interval '2 days'
)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status;

INSERT INTO public.vendor_quotes (
  id, rfq_id, vendor_id, amount, line_items, notes, status, submitted_at
) VALUES (
  'e7777777-7777-7777-7777-777777777701',
  'e6666666-6666-6666-6666-666666666601',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  18500.00,
  '[{"description":"Plated dinner (140 covers)","amount":14000},{"description":"Beverage package","amount":4500}]'::jsonb,
  'Includes service staff through dessert.',
  'submitted', now() - interval '3 days'
)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status;

INSERT INTO public.customer_vendor_quote_offers (
  id, inquiry_id, vendor_quote_id, version, vendor_cost, markup_percent, markup_amount,
  customer_price, notes, status, sent_by, sent_at
) VALUES (
  'e8888888-8888-8888-8888-888888888801',
  'e1111111-1111-1111-1111-111111111103',
  'e7777777-7777-7777-7777-777777777701',
  1, 18500.00, 20, 3700.00, 22200.00,
  'Catering package for Product Launch Night (customer-facing price).',
  'sent', 'manager@gmail.com', now() - interval '1 day'
)
ON CONFLICT (id) DO UPDATE SET customer_price = EXCLUDED.customer_price, status = EXCLUDED.status;

INSERT INTO public.engagement_notifications (inquiry_id, audience, title, body, href)
SELECT * FROM (VALUES
  ('e1111111-1111-1111-1111-111111111101'::uuid, 'internal',
   'New customer inquiry awaiting approval',
   'Demo Customer Spring Leadership Summit needs exec/PM approval and a company quote.',
   '/engagement/approvals'),
  ('e1111111-1111-1111-1111-111111111102', 'customer',
   'Company quote update',
   'Your quote for Demo Customer Client Appreciation Gala was denied — request an amendment if needed.',
   '/dashboard/customer/engagement'),
  ('e1111111-1111-1111-1111-111111111103', 'vendor',
   'RFQ ready for quote',
   'Catering RFQ for Demo Customer Product Launch Night is ready.',
   '/dashboard/vendor'),
  ('e1111111-1111-1111-1111-111111111103', 'customer',
   'Vendor package offer ready',
   'Review the marked-up catering package for Product Launch Night.',
   '/dashboard/customer/engagement')
) AS v(inquiry_id, audience, title, body, href)
WHERE NOT EXISTS (
  SELECT 1 FROM public.engagement_notifications n
  WHERE n.inquiry_id = v.inquiry_id AND n.title = v.title
);

-- Work exception sample skipped: submitted_by_party_id NOT NULL + work_parties FK.
-- Seed would need deliverable/party rows first; omit for showcase simplicity.
