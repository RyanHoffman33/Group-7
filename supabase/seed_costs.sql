-- Cost & Resources seed aligned to Billing/AR contracts (ACCY628-FINAL-PROJECT).
-- Safe to re-run: uses deterministic UUIDs + ON CONFLICT DO NOTHING.
-- Does not create customers/contracts — those come from Billing seed.

INSERT INTO public.vendors (id, name, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Premier Catering Co', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'StageRight AV', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Fleet Travel Partners', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'BrightLight Rentals', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'Bloom & Branch Florals', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'SoundWave Production', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'City Permit Desk', 'active')
ON CONFLICT (id) DO NOTHING;

-- Budgets for every Billing contract (including those previously without costs)
INSERT INTO public.cost_budgets (contract_id, category, budgeted_amount) VALUES
  ('22222222-2222-2222-2222-222222222205', 'labor', 4500),
  ('22222222-2222-2222-2222-222222222205', 'vendor', 9000),
  ('22222222-2222-2222-2222-222222222205', 'materials', 3500),
  ('22222222-2222-2222-2222-222222222205', 'equipment', 2000),
  ('22222222-2222-2222-2222-222222222205', 'travel', 800),
  ('22222222-2222-2222-2222-222222222205', 'other', 600),
  ('22222222-2222-2222-2222-222222222209', 'labor', 2200),
  ('22222222-2222-2222-2222-222222222209', 'vendor', 3500),
  ('22222222-2222-2222-2222-222222222209', 'materials', 1200),
  ('22222222-2222-2222-2222-222222222209', 'equipment', 900),
  ('22222222-2222-2222-2222-222222222207', 'labor', 7000),
  ('22222222-2222-2222-2222-222222222207', 'vendor', 11000),
  ('22222222-2222-2222-2222-222222222207', 'travel', 2500),
  ('22222222-2222-2222-2222-222222222207', 'equipment', 4000),
  ('22222222-2222-2222-2222-222222222207', 'advertising', 1500),
  ('22222222-2222-2222-2222-222222222208', 'labor', 3000),
  ('22222222-2222-2222-2222-222222222208', 'contractor', 8000),
  ('22222222-2222-2222-2222-222222222208', 'travel', 2200),
  ('22222222-2222-2222-2222-222222222208', 'advertising', 1800),
  ('22222222-2222-2222-2222-222222222212', 'labor', 5500),
  ('22222222-2222-2222-2222-222222222212', 'vendor', 14000),
  ('22222222-2222-2222-2222-222222222212', 'equipment', 6000),
  ('22222222-2222-2222-2222-222222222212', 'materials', 2800),
  ('22222222-2222-2222-2222-222222222212', 'advertising', 3500),
  ('22222222-2222-2222-2222-222222222211', 'labor', 4000),
  ('22222222-2222-2222-2222-222222222211', 'payroll', 1500),
  ('22222222-2222-2222-2222-222222222211', 'allocated', 2000),
  ('22222222-2222-2222-2222-222222222211', 'travel', 900),
  ('22222222-2222-2222-2222-222222222210', 'travel', 5000),
  ('22222222-2222-2222-2222-222222222210', 'reimbursable', 4500),
  ('22222222-2222-2222-2222-222222222210', 'labor', 1200),
  ('22222222-2222-2222-2222-222222222203', 'labor', 8000),
  ('22222222-2222-2222-2222-222222222203', 'vendor', 15000),
  ('22222222-2222-2222-2222-222222222203', 'equipment', 5000),
  ('22222222-2222-2222-2222-222222222203', 'materials', 2500),
  ('22222222-2222-2222-2222-222222222203', 'payroll', 2200)
ON CONFLICT (contract_id, category) DO NOTHING;

-- See live DB for full cost_entries inserts (cccccccc-cccc-cccc-cccc-cccccccce001…e040).
-- Applied via migration/seed against ACCY628-FINAL-PROJECT using the same contract IDs
-- as supabase/seed.sql Billing demo (2222…201 through 212).
