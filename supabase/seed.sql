-- Demo seed for Billing & A/R (ACCY628-FINAL-PROJECT)
-- Re-run after truncating dependent tables if you need a clean slate.
--
-- APPLY ORDER (local reset vs shared live DB)
--   1) This file truncates billing/GAAP seed tables — LOCAL / disposable DBs only.
--      Do NOT run the TRUNCATE block against the shared ACCY628 live project.
--   2) Then apply additive enrichment (safe upserts, no truncate):
--        supabase/migrations/20260805210000_seed_data_overhaul.sql
--        supabase/migrations/20260805220000_seed_disputed_invoice.sql
--        supabase/migrations/20260806093000_customer_involvement_model.sql
--        supabase/migrations/20260806120000_comprehensive_seed_historical_ml.sql
--      The comprehensive historical seed adds 36 months × 2 events for Analytics/ML
--      (v_profit_monthly) plus cross-module demo coverage. Idempotent ON CONFLICT.
--   3) Related module seeds (also additive / local): seed_costs.sql, seed_work.sql,
--      seed_contracts_lifecycle.sql
--
-- Demo app logins (in-memory users, password `demo`) are defined in
--   src/features/users/seed.ts — not in SQL.

TRUNCATE public.billing_alerts, public.ar_bucket_state, public.ar_ledger_entries,
  public.payment_applications, public.payments, public.invoice_lines, public.deposits,
  public.invoices, public.customer_payment_stats,
  public.gaap_policies, public.recognition_evidence, public.contract_modifications,
  public.cost_classifications,
  public.contracts, public.customers
  RESTART IDENTITY CASCADE;

INSERT INTO public.customers (id, name, billing_email, payment_terms_days, status) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Northstar Financial Group', 'ap@northstar.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111102', 'Harborview Hospitals', 'billing@harborview.example', 45, 'active'),
  ('11111111-1111-1111-1111-111111111103', 'Summit Tech Labs', 'finance@summittech.example', 15, 'active'),
  ('11111111-1111-1111-1111-111111111104', 'Cedar & Pine Weddings', 'events@cedarpine.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111105', 'Riverfront Civic League', 'treasurer@riverfront.example', 30, 'active');

INSERT INTO public.contracts (id, customer_id, event_name, contract_value, deposit_required, deposit_percent, status, performance_complete, approved_at) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Q3 Leadership Summit', 85000, true, 30, 'approved', true, '2025-11-01'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'Year-End Gala', 120000, true, 25, 'approved', false, '2026-01-15'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', 'Physician Conference', 95000, true, 40, 'approved', true, '2025-10-10'),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111103', 'Product Launch Experience', 64000, true, 30, 'approved', false, '2026-02-01'),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111104', 'Anderson Wedding Weekend', 42000, true, 50, 'approved', true, '2025-09-20'),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111105', 'Riverfront Charity Ball', 55000, true, 35, 'approved', false, '2026-03-01');

INSERT INTO public.invoices (id, contract_id, customer_id, invoice_number, issue_date, due_date, subtotal, tax, total, status, recognition_status, milestone_key, created_by) VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'INV-2025-0001', '2025-08-01', '2025-08-31', 25000, 0, 25000, 'paid', 'recognized', 'final-2025a', 'seed'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'INV-2025-0002', '2025-09-15', '2025-10-15', 30000, 0, 30000, 'paid', 'recognized', 'final-2025b', 'seed'),
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'INV-2025-0003', '2025-11-01', '2025-12-01', 30000, 0, 30000, 'paid', 'recognized', 'final-2025c', 'seed'),
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', 'INV-2025-0004', '2025-07-01', '2025-08-15', 40000, 0, 40000, 'paid', 'recognized', 'final-hv-a', 'seed'),
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', 'INV-2025-0005', '2025-09-01', '2025-10-16', 30000, 0, 30000, 'paid', 'recognized', 'final-hv-b', 'seed'),
  ('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', 'INV-2025-0006', '2025-11-10', '2025-12-25', 25000, 0, 25000, 'paid', 'recognized', 'final-hv-c', 'seed'),
  ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'INV-2026-0007', CURRENT_DATE - 10, CURRENT_DATE + 20, 40000, 0, 40000, 'issued', 'deferred', 'deposit-milestone', 'seed'),
  ('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', 'INV-2026-0008', CURRENT_DATE - 50, CURRENT_DATE - 5, 20000, 0, 20000, 'partially_paid', 'recognized', 'balance-hv', 'seed'),
  ('33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111103', 'INV-2026-0009', CURRENT_DATE - 75, CURRENT_DATE - 60, 32000, 0, 32000, 'disputed', 'deferred', 'launch-progress', 'seed'),
  ('33333333-3333-3333-3333-333333333310', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111104', 'INV-2026-0010', CURRENT_DATE - 120, CURRENT_DATE - 90, 21000, 0, 21000, 'issued', 'recognized', 'wedding-final', 'seed'),
  ('33333333-3333-3333-3333-333333333311', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111105', 'INV-2026-0011', CURRENT_DATE - 40, CURRENT_DATE - 10, 18000, 0, 18000, 'issued', 'deferred', 'ball-progress', 'seed');

INSERT INTO public.invoice_lines (invoice_id, description, amount, performance_obligation_ref) VALUES
  ('33333333-3333-3333-3333-333333333307', 'Year-End Gala — planning milestone', 40000, 'PO-planning'),
  ('33333333-3333-3333-3333-333333333308', 'Physician Conference — remaining balance', 20000, 'PO-event'),
  ('33333333-3333-3333-3333-333333333309', 'Product Launch — production progress', 32000, 'PO-production'),
  ('33333333-3333-3333-3333-333333333310', 'Anderson Wedding — final settlement', 21000, 'PO-event'),
  ('33333333-3333-3333-3333-333333333311', 'Charity Ball — progress billing', 18000, 'PO-progress');

INSERT INTO public.deposits (id, contract_id, customer_id, amount, received_at, status, applied_to_invoice_id) VALUES
  ('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 30000, '2026-01-20', 'unearned', NULL),
  ('44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111103', 19200, '2026-02-05', 'unearned', NULL),
  ('44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111105', 19250, '2026-03-05', 'unearned', NULL),
  ('44444444-4444-4444-4444-444444444404', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 25500, '2025-08-01', 'applied', '33333333-3333-3333-3333-333333333301');

INSERT INTO public.payments (id, customer_id, amount, paid_at, method, reference) VALUES
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111101', 25000, '2025-09-05', 'ach', 'NS-PMT-01'),
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111101', 30000, '2025-10-20', 'ach', 'NS-PMT-02'),
  ('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111101', 30000, '2025-12-10', 'wire', 'NS-PMT-03'),
  ('55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111102', 40000, '2025-09-01', 'ach', 'HV-PMT-01'),
  ('55555555-5555-5555-5555-555555555505', '11111111-1111-1111-1111-111111111102', 30000, '2025-11-20', 'ach', 'HV-PMT-02'),
  ('55555555-5555-5555-5555-555555555506', '11111111-1111-1111-1111-111111111102', 25000, '2026-01-30', 'check', 'HV-PMT-03'),
  ('55555555-5555-5555-5555-555555555507', '11111111-1111-1111-1111-111111111102', 8000, CURRENT_DATE - 2, 'ach', 'HV-PMT-04');

INSERT INTO public.payment_applications (payment_id, invoice_id, amount) VALUES
  ('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333301', 25000),
  ('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333302', 30000),
  ('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333303', 30000),
  ('55555555-5555-5555-5555-555555555504', '33333333-3333-3333-3333-333333333304', 40000),
  ('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333305', 30000),
  ('55555555-5555-5555-5555-555555555506', '33333333-3333-3333-3333-333333333306', 25000),
  ('55555555-5555-5555-5555-555555555507', '33333333-3333-3333-3333-333333333308', 8000);

INSERT INTO public.ar_ledger_entries (invoice_id, entry_type, debit, credit, memo) VALUES
  ('33333333-3333-3333-3333-333333333307', 'invoice_issue', 40000, 0, 'AR debit / deferred revenue'),
  ('33333333-3333-3333-3333-333333333308', 'invoice_issue', 20000, 0, 'AR debit / revenue (performance complete)'),
  ('33333333-3333-3333-3333-333333333308', 'payment_apply', 0, 8000, 'Payment applied'),
  ('33333333-3333-3333-3333-333333333309', 'invoice_issue', 32000, 0, 'AR debit / deferred revenue'),
  ('33333333-3333-3333-3333-333333333310', 'invoice_issue', 21000, 0, 'AR debit / revenue'),
  ('33333333-3333-3333-3333-333333333311', 'invoice_issue', 18000, 0, 'AR debit / deferred revenue');

INSERT INTO public.ar_bucket_state (invoice_id, current_bucket, outstanding_amount) VALUES
  ('33333333-3333-3333-3333-333333333307', 'current', 40000),
  ('33333333-3333-3333-3333-333333333308', '1-30', 12000),
  ('33333333-3333-3333-3333-333333333309', '61-90', 32000),
  ('33333333-3333-3333-3333-333333333310', '90+', 21000),
  ('33333333-3333-3333-3333-333333333311', '1-30', 18000);

INSERT INTO public.customer_payment_stats (customer_id, avg_days_to_pay, on_time_rate, sample_size, bucket_survival) VALUES
  ('11111111-1111-1111-1111-111111111101', 12, 1.0, 3, '{"current":1.0,"1-30":0.98,"31-60":0.95,"61-90":0.90,"90+":0.85}'::jsonb),
  ('11111111-1111-1111-1111-111111111102', 38, 0.33, 3, '{"current":1.0,"1-30":0.92,"31-60":0.85,"61-90":0.75,"90+":0.60}'::jsonb);

-- GAAP Compliance seed
INSERT INTO public.gaap_policies (topic, asc_reference, mainevent_rule, evidence_required, sort_order) VALUES
  ('When revenue is recognized','ASC 606-10-25','Revenue is recognized when (or as) performance obligations for an event are satisfied — typically at event completion or agreed milestone delivery, not merely when cash is collected.','Customer approval, event completion sign-off, or milestone acceptance on file',1),
  ('Evidence supporting recognition','ASC 606-10-25-27','Recognition requires documented evidence that control transferred or the milestone was accepted. Cash receipt alone is not evidence of earning.','recognition_evidence row linked to contract/invoice before recognition posts',2),
  ('Deposits and retainers','ASC 606-10-45 / liability','Customer deposits and unused retainer draws are contract liabilities (unearned) until performance is delivered or the deposit is applied to an earned invoice.','Deposit status unearned|applied; retainer invoices issue only per schedule terms',3),
  ('Cost classification','ASC 340-40 / matching','Direct event production costs are matched to event revenue as COGS. Reimbursable pass-throughs are not margin. Overhead is period expense.','cost_classifications on each cost_ref before profitability reporting',4),
  ('Contract modifications','ASC 606-10-25-10..13','Change orders adjust transaction price prospectively unless the remaining goods/services are not distinct — then cumulative catch-up. Historical invoices are never silently rewritten.','Approved contract_modifications with prior_contract_value preserved',5),
  ('Unpaid customer balances','ASC 310 / presentation','Open A/R is presented by aging and recognition status (deferred vs recognized). Disputed balances remain in A/R until resolved or written off.','v_ar_outstanding + aging buckets + dispute status',6),
  ('Billed before vs after performance','ASC 606 contract liability/asset','Amounts billed before performance create deferred revenue / contract liability. Performance before billing creates a contract asset (earned not billed).','Compare performance_complete / progress to billed_to_date on v_gaap_contract_position',7),
  ('Earned but not yet billed','ASC 606 contract asset','Progress completed or milestones accepted but not yet invoiced are reported as contract assets, not as A/R.','v_contract_asset.contract_asset > 0',8),
  ('Recurring arrangements','ASC 606 series of distinct periods','Monthly retainers/recurring fees are recognized as each service period is provided (generally upon scheduled invoice for that period), not when the annual engagement is signed.','billing_schedules + invoice recognition_status per period',9),
  ('Profitability measurement','Matching principle','Event margin = recognized revenue − direct_event_cogs; reimbursable passthrough excluded from margin; overhead separate.','v_profitability_inputs',10),
  ('Auditability and financial reporting support','ASC 606 disclosure / controls','Append-only ledger entries, recognition evidence, and modification history support audit and period reporting.','ar_ledger_entries + recognition_evidence + contract_modifications',11);

INSERT INTO public.recognition_evidence (id, contract_id, invoice_id, evidence_type, evidence_date, description, supporting_ref) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333301','event_completion','2025-09-01','Q3 Leadership Summit completed; client walkthrough signed','DOC-NS-CLOSE-001'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02','22222222-2222-2222-2222-222222222203','33333333-3333-3333-3333-333333333304','customer_approval','2025-08-20','Physician Conference final run-of-show approved','DOC-HV-APPROVAL-004'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03','22222222-2222-2222-2222-222222222205','33333333-3333-3333-3333-333333333310','delivery_acceptance','2026-01-15','Anderson Wedding weekend delivered; acceptance email on file','DOC-CP-ACCEPT-010'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04','22222222-2222-2222-2222-222222222202',NULL,'milestone_signoff','2026-03-01','Year-End Gala design package approved (milestone)','DOC-NS-MILE-DESIGN');

INSERT INTO public.contract_modifications (id, contract_id, mod_number, effective_date, description, price_change, prior_contract_value, scope_change_notes, accounting_treatment, status, approved_by) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','22222222-2222-2222-2222-222222222204','CO-001','2026-03-15','Add LED wall day + overnight security',8500,64000,'Distinct additional services — prospective price increase','prospective','approved','gabriel-stub'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','22222222-2222-2222-2222-222222222206','CO-001','2026-02-01','Reduce ballroom hours (scope cut)',-4000,55000,'Remaining services not substantially distinct from original — catch-up remaining TP','cumulative_catchup','draft',NULL);

INSERT INTO public.cost_classifications (id, cost_ref_id, cost_source, contract_id, classification, period, amount, notes) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01','77777777-7777-7777-7777-777777777701','billable_costs','22222222-2222-2222-2222-222222222204','direct_event_cogs','2026-03-01',8200,'LED wall rental — direct production'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02','77777777-7777-7777-7777-777777777702','billable_costs','22222222-2222-2222-2222-222222222204','reimbursable_passthrough','2026-03-01',340,'Courier — pass-through'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03','77777777-7777-7777-7777-777777777703','billable_costs','22222222-2222-2222-2222-222222222205','direct_event_cogs','2026-01-01',4100,'Floral wholesale — direct'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc04','77777777-7777-7777-7777-777777777704','billable_costs','22222222-2222-2222-2222-222222222205','reimbursable_passthrough','2026-01-01',275,'Permit fees — passthrough'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc05','77777777-7777-7777-7777-777777777705','billable_costs','22222222-2222-2222-2222-222222222204','reimbursable_passthrough','2026-02-01',1860,'Airfare — reimbursable'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc06','77777777-7777-7777-7777-777777777706','billable_costs','22222222-2222-2222-2222-222222222204','reimbursable_passthrough','2026-02-01',2400,'Hotel — reimbursable');
