-- ============================================================================
-- Comprehensive seed: 36-month historical P&L + cross-module demo enrichment
-- Project: ACCY628-FINAL-PROJECT (eslwjydxevrdgeiqkwtq)
--
-- PURPOSE
--   Feed Analytics / ML forecasting (v_profit_monthly) with ≥24 months of
--   non-trivial recognized revenue + matching COGS, plus fill demo gaps across
--   billing, GAAP, costs, work, and customer involvement.
--
-- SAFETY
--   Additive only: INSERT … ON CONFLICT / WHERE NOT EXISTS / targeted UPDATEs.
--   Does NOT TRUNCATE, DROP, ALTER, or DELETE teammate data.
--   Demo logins (in-app seed users, password `demo`) are untouched.
--
-- APPLY (after human approval — do not auto-apply to shared live DB)
--   1) Review this file.
--   2) Apply via Supabase SQL editor / MCP apply_migration / CLI with approval.
--   3) Validate:
--        SELECT month, recognized_revenue, direct_cogs, gross_margin
--        FROM public.v_profit_monthly ORDER BY month;
--      Expect continuous months from ~2023-09 through current with no long
--      near-zero revenue tails.
--
-- ID NAMESPACE (fixed UUIDs for idempotent re-runs)
--   Customers …… 11111111-…-111111111110 .. 113
--   Contracts …… 22222222-…-000000003000 .. 3071  (+ 3100 edge cases)
--   Invoices ……… 33333333-…-000000004000 .. 4071  (+ 4100 edge)
--   Payments ……… 55555555-…-000000004000 .. 4071
--   Evidence ……… aaaaaaaa-…-000000004000 .. 4071
--   Cost entries … cccccccc-…-00000000d000 .. (labor/vendor/equip per event)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Helper: deterministic seasonal multiplier (event industry pattern)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_season_mult(m int)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE m
    WHEN 1 THEN 0.82::numeric
    WHEN 2 THEN 0.88
    WHEN 3 THEN 1.05
    WHEN 4 THEN 1.10
    WHEN 5 THEN 1.18
    WHEN 6 THEN 1.14
    WHEN 7 THEN 0.96
    WHEN 8 THEN 0.98
    WHEN 9 THEN 1.08
    WHEN 10 THEN 1.12
    WHEN 11 THEN 1.20
    WHEN 12 THEN 1.28
    ELSE 1.0
  END;
$$;

COMMENT ON FUNCTION public._seed_season_mult(int) IS
  'Seed-only seasonal multiplier for comprehensive historical seed; safe to keep.';

-- ---------------------------------------------------------------------------
-- 1) Extra customers for portfolio diversity (existing 101–108 kept)
-- ---------------------------------------------------------------------------
INSERT INTO public.customers (id, name, billing_email, payment_terms_days, status)
VALUES
  ('11111111-1111-1111-1111-111111111110', 'Horizon Biotech', 'ap@horizonbio.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111111', 'Metro Chamber Alliance', 'events@metrochamber.example', 45, 'active'),
  ('11111111-1111-1111-1111-111111111112', 'BrightPath Education', 'finance@brightpath.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111113', 'Cascade Outdoor Brands', 'billing@cascadeob.example', 15, 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  billing_email = EXCLUDED.billing_email,
  status = EXCLUDED.status;

-- Payment behavior context for analytics / AR demos
INSERT INTO public.customer_payment_stats
  (customer_id, avg_days_to_pay, on_time_rate, sample_size, bucket_survival)
VALUES
  ('11111111-1111-1111-1111-111111111110', 18, 0.92, 24,
   '{"current":1.0,"1-30":0.97,"31-60":0.93,"61-90":0.88,"90+":0.80}'::jsonb),
  ('11111111-1111-1111-1111-111111111111', 28, 0.78, 20,
   '{"current":1.0,"1-30":0.94,"31-60":0.88,"61-90":0.80,"90+":0.70}'::jsonb),
  ('11111111-1111-1111-1111-111111111112', 14, 0.96, 18,
   '{"current":1.0,"1-30":0.99,"31-60":0.96,"61-90":0.92,"90+":0.88}'::jsonb),
  ('11111111-1111-1111-1111-111111111113', 35, 0.60, 16,
   '{"current":1.0,"1-30":0.90,"31-60":0.82,"61-90":0.72,"90+":0.55}'::jsonb)
ON CONFLICT (customer_id) DO UPDATE SET
  avg_days_to_pay = EXCLUDED.avg_days_to_pay,
  on_time_rate = EXCLUDED.on_time_rate,
  sample_size = EXCLUDED.sample_size,
  bucket_survival = EXCLUDED.bucket_survival,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) 36 months × 2 completed events (Sep 2023 – Aug 2026)
--    Seasonal + mild trend + deterministic noise; each event fully billed,
--    paid, recognized with evidence_date in the event month (feeds v_profit_monthly).
-- ---------------------------------------------------------------------------
WITH months AS (
  SELECT
    gs AS month_start,
    (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(
    DATE '2023-09-01',
    DATE '2026-08-01',
    INTERVAL '1 month'
  ) AS gs
),
slots AS (
  -- Two events per month → 72 contracts (indices 0..71)
  SELECT
    m.month_start,
    m.month_idx,
    e AS event_slot, -- 0 or 1
    (m.month_idx * 2 + e) AS n
  FROM months m
  CROSS JOIN generate_series(0, 1) AS e
),
built AS (
  SELECT
    s.*,
    -- Fixed UUIDs
    ('22222222-2222-2222-2222-' || lpad((3000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('33333333-3333-3333-3333-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS invoice_id,
    ('55555555-5555-5555-5555-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS payment_id,
    ('aaaaaaaa-aaaa-aaaa-aaaa-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS evidence_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53248 + s.n * 3)::text, 12, '0'))::uuid AS cost_labor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53249 + s.n * 3)::text, 12, '0'))::uuid AS cost_vendor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53250 + s.n * 3)::text, 12, '0'))::uuid AS cost_equip_id,
    -- Rotate customers (existing + new)
    (ARRAY[
      '11111111-1111-1111-1111-111111111101'::uuid,
      '11111111-1111-1111-1111-111111111102'::uuid,
      '11111111-1111-1111-1111-111111111103'::uuid,
      '11111111-1111-1111-1111-111111111104'::uuid,
      '11111111-1111-1111-1111-111111111105'::uuid,
      '11111111-1111-1111-1111-111111111106'::uuid,
      '11111111-1111-1111-1111-111111111107'::uuid,
      '11111111-1111-1111-1111-111111111110'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      '11111111-1111-1111-1111-111111111112'::uuid,
      '11111111-1111-1111-1111-111111111113'::uuid
    ])[1 + (s.n % 11)] AS customer_id,
    (ARRAY[
      'corporate_conference','gala','wedding','product_launch','fundraiser',
      'trade_show','holiday_party','corporate_event'
    ])[1 + (s.n % 8)] AS event_type,
    (ARRAY[
      'fixed_price','milestone','progress','fixed_price','retainer','fixed_price'
    ])[1 + (s.n % 6)] AS billing_method,
    (ARRAY[
      'collaborative','collaborative','full_service','custom','collaborative'
    ])[1 + (s.n % 5)] AS involvement_model,
    (ARRAY[
      'Alex Rivera','Jordan Blake','Morgan Ellis','Sam Okonkwo','Emily Gray'
    ])[1 + (s.n % 5)] AS pm_label,
    (ARRAY[
      'Chicago','Seattle','Austin','Madison','Napa','Richmond','Denver','Boston'
    ])[1 + (s.n % 8)] AS venue_city,
    -- Event day mid-month, staggered by slot
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    -- Contract value: base × season × trend × noise; slot 1 slightly smaller
    round(
      (52000 + s.event_slot * 18000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * (1 + 0.011 * s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 21) - 10)::numeric / 100))
      / 100
    ) * 100 AS contract_value,
    -- Occasional thin-margin event (~every 13th) for profitability exceptions without
    -- collapsing the monthly series
    CASE WHEN s.n % 13 = 7 THEN 0.92 ELSE 0.58 END AS cogs_ratio
  FROM slots s
),
priced AS (
  SELECT
    b.*,
    greatest(b.contract_value, 28000)::numeric AS cv,
    round(greatest(b.contract_value, 28000) * b.cogs_ratio, 2) AS total_cogs
  FROM built b
)
-- 2a) Contracts
INSERT INTO public.contracts (
  id, customer_id, contract_number, event_name, contract_value, original_contract_value,
  deposit_required, deposit_percent, status, performance_complete, approved_at,
  billing_method, event_type, event_start, event_end, venue_name, venue_city,
  guest_count, project_manager_label, approved_by, completed_at, closed_at,
  closeout_notes, change_order_value_total, progress_percent, involvement_model,
  currency, activated_at, terms_locked_at
)
SELECT
  p.contract_id,
  p.customer_id,
  'ME-' || to_char(p.event_day, 'YYYY') || '-' || lpad((3000 + p.n)::text, 12, '0'),
  initcap(replace(p.event_type, '_', ' ')) || ' — Hist '
    || to_char(p.month_start, 'Mon YYYY')
    || CASE p.event_slot WHEN 0 THEN ' A' ELSE ' B' END,
  p.cv,
  p.cv,
  true,
  30,
  'closed',
  true,
  (p.event_day - 60)::timestamptz,
  p.billing_method,
  p.event_type,
  (p.event_day::text || ' 09:00:00+00')::timestamptz,
  (p.event_day::text || ' 22:00:00+00')::timestamptz,
  'MainEvent Venue ' || (1 + (p.n % 6))::text,
  p.venue_city,
  80 + (p.n % 20) * 10,
  p.pm_label,
  p.pm_label,
  (p.event_day::text || ' 23:00:00+00')::timestamptz,
  (p.event_day + 14)::timestamptz,
  'Historical seed event — closed after final collection (ML series).',
  0,
  100,
  p.involvement_model,
  'USD',
  (p.event_day - 45)::timestamptz,
  (p.event_day - 60)::timestamptz
FROM priced p
ON CONFLICT (id) DO UPDATE SET
  contract_value = EXCLUDED.contract_value,
  original_contract_value = EXCLUDED.original_contract_value,
  status = EXCLUDED.status,
  performance_complete = EXCLUDED.performance_complete,
  event_start = EXCLUDED.event_start,
  event_end = EXCLUDED.event_end,
  completed_at = EXCLUDED.completed_at,
  closed_at = EXCLUDED.closed_at,
  involvement_model = EXCLUDED.involvement_model;

-- Re-materialize priced CTE for dependent inserts (same definitions)
WITH months AS (
  SELECT
    gs AS month_start,
    (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2023-09-01', DATE '2026-08-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
built AS (
  SELECT
    s.*,
    ('22222222-2222-2222-2222-' || lpad((3000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('33333333-3333-3333-3333-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS invoice_id,
    ('55555555-5555-5555-5555-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS payment_id,
    ('aaaaaaaa-aaaa-aaaa-aaaa-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS evidence_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53248 + s.n * 3)::text, 12, '0'))::uuid AS cost_labor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53249 + s.n * 3)::text, 12, '0'))::uuid AS cost_vendor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53250 + s.n * 3)::text, 12, '0'))::uuid AS cost_equip_id,
    (ARRAY[
      '11111111-1111-1111-1111-111111111101'::uuid,
      '11111111-1111-1111-1111-111111111102'::uuid,
      '11111111-1111-1111-1111-111111111103'::uuid,
      '11111111-1111-1111-1111-111111111104'::uuid,
      '11111111-1111-1111-1111-111111111105'::uuid,
      '11111111-1111-1111-1111-111111111106'::uuid,
      '11111111-1111-1111-1111-111111111107'::uuid,
      '11111111-1111-1111-1111-111111111110'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      '11111111-1111-1111-1111-111111111112'::uuid,
      '11111111-1111-1111-1111-111111111113'::uuid
    ])[1 + (s.n % 11)] AS customer_id,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    round(
      (52000 + s.event_slot * 18000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * (1 + 0.011 * s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 21) - 10)::numeric / 100))
      / 100
    ) * 100 AS contract_value,
    CASE WHEN s.n % 13 = 7 THEN 0.92 ELSE 0.58 END AS cogs_ratio
  FROM slots s
),
priced AS (
  SELECT
    b.*,
    greatest(b.contract_value, 28000)::numeric AS cv,
    round(greatest(b.contract_value, 28000) * b.cogs_ratio, 2) AS total_cogs
  FROM built b
),
-- 2b) Invoices (paid + recognized)
ins_inv AS (
  INSERT INTO public.invoices (
    id, contract_id, customer_id, invoice_number, issue_date, due_date,
    subtotal, tax, total, status, recognition_status, milestone_key, created_by,
    billing_method
  )
  SELECT
    p.invoice_id,
    p.contract_id,
    p.customer_id,
    'INV-HIST-' || lpad((4000 + p.n)::text, 4, '0'),
    p.event_day - 3,
    p.event_day + 27,
    p.cv, 0, p.cv,
    'paid',
    'recognized',
    'hist-final-' || p.n::text,
    'seed-hist',
    'fixed_price'
  FROM priced p
  ON CONFLICT (id) DO UPDATE SET
    total = EXCLUDED.total,
    subtotal = EXCLUDED.subtotal,
    status = EXCLUDED.status,
    recognition_status = EXCLUDED.recognition_status,
    issue_date = EXCLUDED.issue_date
  RETURNING id
)
SELECT count(*) AS invoices_upserted FROM ins_inv;

WITH months AS (
  SELECT
    gs AS month_start,
    (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2023-09-01', DATE '2026-08-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
built AS (
  SELECT
    s.*,
    ('22222222-2222-2222-2222-' || lpad((3000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('33333333-3333-3333-3333-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS invoice_id,
    ('55555555-5555-5555-5555-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS payment_id,
    ('aaaaaaaa-aaaa-aaaa-aaaa-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS evidence_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53248 + s.n * 3)::text, 12, '0'))::uuid AS cost_labor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53249 + s.n * 3)::text, 12, '0'))::uuid AS cost_vendor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53250 + s.n * 3)::text, 12, '0'))::uuid AS cost_equip_id,
    (ARRAY[
      '11111111-1111-1111-1111-111111111101'::uuid,
      '11111111-1111-1111-1111-111111111102'::uuid,
      '11111111-1111-1111-1111-111111111103'::uuid,
      '11111111-1111-1111-1111-111111111104'::uuid,
      '11111111-1111-1111-1111-111111111105'::uuid,
      '11111111-1111-1111-1111-111111111106'::uuid,
      '11111111-1111-1111-1111-111111111107'::uuid,
      '11111111-1111-1111-1111-111111111110'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      '11111111-1111-1111-1111-111111111112'::uuid,
      '11111111-1111-1111-1111-111111111113'::uuid
    ])[1 + (s.n % 11)] AS customer_id,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    round(
      (52000 + s.event_slot * 18000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * (1 + 0.011 * s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 21) - 10)::numeric / 100))
      / 100
    ) * 100 AS contract_value,
    CASE WHEN s.n % 13 = 7 THEN 0.92 ELSE 0.58 END AS cogs_ratio
  FROM slots s
),
priced AS (
  SELECT
    b.*,
    greatest(b.contract_value, 28000)::numeric AS cv,
    round(greatest(b.contract_value, 28000) * b.cogs_ratio, 2) AS total_cogs
  FROM built b
)
-- 2c) Invoice lines (idempotent by description)
INSERT INTO public.invoice_lines (invoice_id, description, amount, performance_obligation_ref, line_type)
SELECT
  p.invoice_id,
  'Historical event delivery — full settlement',
  p.cv,
  'PO-event',
  'fixed'
FROM priced p
WHERE EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = p.invoice_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_lines il
    WHERE il.invoice_id = p.invoice_id
      AND il.description = 'Historical event delivery — full settlement'
  );

WITH months AS (
  SELECT
    gs AS month_start,
    (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2023-09-01', DATE '2026-08-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
built AS (
  SELECT
    s.*,
    ('22222222-2222-2222-2222-' || lpad((3000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('33333333-3333-3333-3333-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS invoice_id,
    ('55555555-5555-5555-5555-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS payment_id,
    ('aaaaaaaa-aaaa-aaaa-aaaa-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS evidence_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53248 + s.n * 3)::text, 12, '0'))::uuid AS cost_labor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53249 + s.n * 3)::text, 12, '0'))::uuid AS cost_vendor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53250 + s.n * 3)::text, 12, '0'))::uuid AS cost_equip_id,
    (ARRAY[
      '11111111-1111-1111-1111-111111111101'::uuid,
      '11111111-1111-1111-1111-111111111102'::uuid,
      '11111111-1111-1111-1111-111111111103'::uuid,
      '11111111-1111-1111-1111-111111111104'::uuid,
      '11111111-1111-1111-1111-111111111105'::uuid,
      '11111111-1111-1111-1111-111111111106'::uuid,
      '11111111-1111-1111-1111-111111111107'::uuid,
      '11111111-1111-1111-1111-111111111110'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      '11111111-1111-1111-1111-111111111112'::uuid,
      '11111111-1111-1111-1111-111111111113'::uuid
    ])[1 + (s.n % 11)] AS customer_id,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    round(
      (52000 + s.event_slot * 18000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * (1 + 0.011 * s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 21) - 10)::numeric / 100))
      / 100
    ) * 100 AS contract_value,
    CASE WHEN s.n % 13 = 7 THEN 0.92 ELSE 0.58 END AS cogs_ratio
  FROM slots s
),
priced AS (
  SELECT
    b.*,
    greatest(b.contract_value, 28000)::numeric AS cv,
    round(greatest(b.contract_value, 28000) * b.cogs_ratio, 2) AS total_cogs
  FROM built b
)
-- 2d) Recognition evidence (dates recognition month for v_profit_monthly)
INSERT INTO public.recognition_evidence (
  id, contract_id, invoice_id, evidence_type, evidence_date, description, supporting_ref, created_by
)
SELECT
  p.evidence_id,
  p.contract_id,
  p.invoice_id,
  'event_completion',
  p.event_day,
  'Historical event completed; client sign-off on file',
  'DOC-HIST-' || lpad((4000 + p.n)::text, 4, '0'),
  'seed-hist'
FROM priced p
ON CONFLICT (id) DO UPDATE SET
  evidence_date = EXCLUDED.evidence_date,
  invoice_id = EXCLUDED.invoice_id,
  description = EXCLUDED.description;

WITH months AS (
  SELECT
    gs AS month_start,
    (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2023-09-01', DATE '2026-08-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
built AS (
  SELECT
    s.*,
    ('22222222-2222-2222-2222-' || lpad((3000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('33333333-3333-3333-3333-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS invoice_id,
    ('55555555-5555-5555-5555-' || lpad((4000 + s.n)::text, 12, '0'))::uuid AS payment_id,
    (ARRAY[
      '11111111-1111-1111-1111-111111111101'::uuid,
      '11111111-1111-1111-1111-111111111102'::uuid,
      '11111111-1111-1111-1111-111111111103'::uuid,
      '11111111-1111-1111-1111-111111111104'::uuid,
      '11111111-1111-1111-1111-111111111105'::uuid,
      '11111111-1111-1111-1111-111111111106'::uuid,
      '11111111-1111-1111-1111-111111111107'::uuid,
      '11111111-1111-1111-1111-111111111110'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      '11111111-1111-1111-1111-111111111112'::uuid,
      '11111111-1111-1111-1111-111111111113'::uuid
    ])[1 + (s.n % 11)] AS customer_id,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    round(
      (52000 + s.event_slot * 18000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * (1 + 0.011 * s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 21) - 10)::numeric / 100))
      / 100
    ) * 100 AS contract_value
  FROM slots s
),
priced AS (
  SELECT b.*, greatest(b.contract_value, 28000)::numeric AS cv FROM built b
)
-- 2e) Payments + applications (paid ≈ invoice totals)
INSERT INTO public.payments (id, customer_id, amount, paid_at, method, reference)
SELECT
  p.payment_id,
  p.customer_id,
  p.cv,
  p.event_day + 10,
  CASE WHEN p.n % 3 = 0 THEN 'wire' WHEN p.n % 3 = 1 THEN 'ach' ELSE 'check' END,
  'HIST-PMT-' || lpad((4000 + p.n)::text, 4, '0')
FROM priced p
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  paid_at = EXCLUDED.paid_at;

INSERT INTO public.payment_applications (payment_id, invoice_id, amount)
SELECT
  ('55555555-5555-5555-5555-' || lpad((4000 + n)::text, 12, '0'))::uuid,
  ('33333333-3333-3333-3333-' || lpad((4000 + n)::text, 12, '0'))::uuid,
  i.total
FROM generate_series(0, 71) AS n
JOIN public.invoices i
  ON i.id = ('33333333-3333-3333-3333-' || lpad((4000 + n)::text, 12, '0'))::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_applications pa
  WHERE pa.payment_id = ('55555555-5555-5555-5555-' || lpad((4000 + n)::text, 12, '0'))::uuid
    AND pa.invoice_id = i.id
);

-- 2f) Cost budgets + actual COGS (labor / vendor / equipment split)
WITH months AS (
  SELECT
    gs AS month_start,
    (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2023-09-01', DATE '2026-08-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
built AS (
  SELECT
    s.*,
    ('22222222-2222-2222-2222-' || lpad((3000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53248 + s.n * 3)::text, 12, '0'))::uuid AS cost_labor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53249 + s.n * 3)::text, 12, '0'))::uuid AS cost_vendor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53250 + s.n * 3)::text, 12, '0'))::uuid AS cost_equip_id,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    round(
      (52000 + s.event_slot * 18000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * (1 + 0.011 * s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 21) - 10)::numeric / 100))
      / 100
    ) * 100 AS contract_value,
    CASE WHEN s.n % 13 = 7 THEN 0.92 ELSE 0.58 END AS cogs_ratio
  FROM slots s
),
priced AS (
  SELECT
    b.*,
    greatest(b.contract_value, 28000)::numeric AS cv,
    round(greatest(b.contract_value, 28000) * b.cogs_ratio, 2) AS total_cogs
  FROM built b
)
INSERT INTO public.cost_budgets (contract_id, category, budgeted_amount)
SELECT contract_id, cat, amt
FROM priced p
CROSS JOIN LATERAL (VALUES
  ('labor'::text, round(p.cv * 0.22, 2)),
  ('vendor', round(p.cv * 0.28, 2)),
  ('equipment', round(p.cv * 0.12, 2))
) AS v(cat, amt)
ON CONFLICT (contract_id, category) DO NOTHING;

WITH months AS (
  SELECT
    gs AS month_start,
    (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2023-09-01', DATE '2026-08-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
built AS (
  SELECT
    s.*,
    ('22222222-2222-2222-2222-' || lpad((3000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53248 + s.n * 3)::text, 12, '0'))::uuid AS cost_labor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53249 + s.n * 3)::text, 12, '0'))::uuid AS cost_vendor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((53250 + s.n * 3)::text, 12, '0'))::uuid AS cost_equip_id,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    round(
      (52000 + s.event_slot * 18000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * (1 + 0.011 * s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 21) - 10)::numeric / 100))
      / 100
    ) * 100 AS contract_value,
    CASE WHEN s.n % 13 = 7 THEN 0.92 ELSE 0.58 END AS cogs_ratio
  FROM slots s
),
priced AS (
  SELECT
    b.*,
    greatest(b.contract_value, 28000)::numeric AS cv,
    round(greatest(b.contract_value, 28000) * b.cogs_ratio, 2) AS total_cogs
  FROM built b
)
INSERT INTO public.cost_entries (
  id, contract_id, entry_type, category, amount, hours, rate, worker_label,
  vendor_name, invoice_ref, commitment_status, approval_status, is_reimbursable,
  notes, entered_by, incurred_date
)
SELECT * FROM (
  SELECT
    p.cost_labor_id, p.contract_id, 'labor'::text, 'labor'::text,
    round(p.total_cogs * 0.35, 2),
    40::numeric, round(p.total_cogs * 0.35 / 40, 2), 'Hist Crew Lead'::text,
    NULL::text, NULL::text, 'actual'::text, 'approved'::text, false,
    'Historical labor actuals'::text, 'seed-hist'::text, p.event_day
  FROM priced p
  UNION ALL
  SELECT
    p.cost_vendor_id, p.contract_id, 'vendor_expense', 'vendor',
    round(p.total_cogs * 0.45, 2),
    NULL, NULL, NULL,
    'Premier Catering Co', 'HIST-V-' || lpad((4000 + p.n)::text, 4, '0'),
    'actual', 'approved', false,
    'Historical vendor production', 'seed-hist', p.event_day
  FROM priced p
  UNION ALL
  SELECT
    p.cost_equip_id, p.contract_id, 'vendor_expense', 'equipment',
    round(p.total_cogs * 0.20, 2),
    NULL, NULL, NULL,
    'StageRight AV', 'HIST-E-' || lpad((4000 + p.n)::text, 4, '0'),
    'actual', 'not_required', false,
    'Historical equipment rental', 'seed-hist', p.event_day
  FROM priced p
) x
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  incurred_date = EXCLUDED.incurred_date,
  commitment_status = EXCLUDED.commitment_status;

-- 2g) Light monthly overhead (period expense) on a rotating historical contract
INSERT INTO public.cost_entries (
  id, contract_id, entry_type, category, amount, commitment_status, approval_status,
  is_reimbursable, notes, entered_by, incurred_date
)
SELECT
  ('cccccccc-cccc-cccc-cccc-' || lpad((54000 + m.month_idx)::text, 12, '0'))::uuid,
  ('22222222-2222-2222-2222-' || lpad((3000 + (m.month_idx * 2))::text, 12, '0'))::uuid,
  'vendor_expense',
  'allocated',
  2500 + (m.month_idx % 5) * 150,
  'actual',
  'not_required',
  false,
  'Shared ops overhead allocation (period expense)',
  'seed-hist',
  m.month_start
FROM (
  SELECT
    gs::date AS month_start,
    (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2023-09-01', DATE '2026-08-01', INTERVAL '1 month') AS gs
) m
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  incurred_date = EXCLUDED.incurred_date;

-- ---------------------------------------------------------------------------
-- 3) Cross-module enrichment (edge statuses, approvals, GAAP, alerts)
-- ---------------------------------------------------------------------------

-- 3a) Cancellation with forfeited deposit recognized as fee (ASC 606 narrative)
INSERT INTO public.contracts (
  id, customer_id, contract_number, event_name, contract_value, original_contract_value,
  deposit_required, deposit_percent, status, performance_complete, approved_at,
  billing_method, event_type, event_start, event_end, venue_name, venue_city,
  guest_count, project_manager_label, approved_by, canceled_at, cancel_reason,
  canceled_by, cancellation_fee_percent, involvement_model, currency, notes
) VALUES (
  '22222222-2222-2222-2222-000000003100',
  '11111111-1111-1111-1111-111111111113',
  'ME-2025-000000003100',
  'Cascade Brand Summit (Canceled)',
  75000, 75000, true, 40, 'canceled', false, '2025-06-01',
  'fixed_price', 'corporate_conference',
  '2025-09-20 09:00:00+00', '2025-09-21 17:00:00+00',
  'Cascade HQ Campus', 'Portland', 300, 'Sam Okonkwo', 'Sam Okonkwo',
  '2025-08-01 16:00:00+00', 'Client reorg — event withdrawn 50 days out',
  'Sam Okonkwo', 40, 'collaborative', 'USD',
  'Cancellation fee / deposit forfeit demo for profitability + GAAP.'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  canceled_at = EXCLUDED.canceled_at,
  cancel_reason = EXCLUDED.cancel_reason;

INSERT INTO public.invoices (
  id, contract_id, customer_id, invoice_number, issue_date, due_date,
  subtotal, tax, total, status, recognition_status, milestone_key, created_by, status_note
) VALUES (
  '33333333-3333-3333-3333-000000004100',
  '22222222-2222-2222-2222-000000003100',
  '11111111-1111-1111-1111-111111111113',
  'INV-HIST-4100', '2025-08-02', '2025-09-01',
  30000, 0, 30000, 'paid', 'recognized', 'cancel-fee', 'seed-hist',
  'Cancellation fee = 40% of CV; deposit applied'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  recognition_status = EXCLUDED.recognition_status,
  total = EXCLUDED.total;

INSERT INTO public.invoice_lines (invoice_id, description, amount, performance_obligation_ref, line_type)
SELECT '33333333-3333-3333-3333-000000004100', 'Cancellation fee (40% of contract value)', 30000, 'PO-cancel', 'fixed'
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_lines
  WHERE invoice_id = '33333333-3333-3333-3333-000000004100'
    AND description = 'Cancellation fee (40% of contract value)'
);

INSERT INTO public.deposits (
  id, contract_id, customer_id, amount, received_at, status, applied_to_invoice_id
) VALUES (
  '44444444-4444-4444-4444-000000004100',
  '22222222-2222-2222-2222-000000003100',
  '11111111-1111-1111-1111-111111111113',
  30000, '2025-06-10', 'applied', '33333333-3333-3333-3333-000000004100'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  applied_to_invoice_id = EXCLUDED.applied_to_invoice_id;

INSERT INTO public.payments (id, customer_id, amount, paid_at, method, reference)
VALUES (
  '55555555-5555-5555-5555-000000004100',
  '11111111-1111-1111-1111-111111111113',
  30000, '2025-06-10', 'ach', 'CASCADE-DEP-FORFEIT'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payment_applications (payment_id, invoice_id, amount)
SELECT '55555555-5555-5555-5555-000000004100', '33333333-3333-3333-3333-000000004100', 30000
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_applications
  WHERE payment_id = '55555555-5555-5555-5555-000000004100'
    AND invoice_id = '33333333-3333-3333-3333-000000004100'
);

INSERT INTO public.recognition_evidence (
  id, contract_id, invoice_id, evidence_type, evidence_date, description, supporting_ref, created_by
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-000000004100',
  '22222222-2222-2222-2222-000000003100',
  '33333333-3333-3333-3333-000000004100',
  'other', '2025-08-01',
  'Cancellation executed; deposit forfeited per policy and recognized as fee',
  'DOC-CANCEL-CASCADE-3100', 'seed-hist'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cost_entries (
  id, contract_id, entry_type, category, amount, vendor_name, invoice_ref,
  commitment_status, approval_status, is_reimbursable, notes, entered_by, incurred_date
) VALUES (
  'cccccccc-cccc-cccc-cccc-00000000d100',
  '22222222-2222-2222-2222-000000003100',
  'vendor_expense', 'vendor', 4200, 'BrightStage AV', 'BS-CANCEL-HOLD',
  'actual', 'approved', false,
  'Non-refundable venue/AV hold costs before cancellation',
  'seed-hist', '2025-07-15'
)
ON CONFLICT (id) DO NOTHING;

-- 3b) Draft + void invoices on Summer Showcase (billing status coverage)
INSERT INTO public.invoices (
  id, contract_id, customer_id, invoice_number, issue_date, due_date,
  subtotal, tax, total, status, recognition_status, milestone_key, created_by, status_note
) VALUES
(
  '33333333-3333-3333-3333-000000004101',
  '22222222-2222-2222-2222-222222222224',
  '11111111-1111-1111-1111-111111111102',
  'INV-2026-DRAFT-01', CURRENT_DATE, CURRENT_DATE + 30,
  8000, 0, 8000, 'draft', 'deferred', 'showcase-draft', 'seed-hist',
  'Draft progress bill — not yet issued'
),
(
  '33333333-3333-3333-3333-000000004102',
  '22222222-2222-2222-2222-222222222224',
  '11111111-1111-1111-1111-111111111102',
  'INV-2026-VOID-01', CURRENT_DATE - 20, CURRENT_DATE + 10,
  5000, 0, 5000, 'void', 'deferred', 'showcase-void', 'seed-hist',
  'Voided duplicate draft'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  status_note = EXCLUDED.status_note;

UPDATE public.invoices
SET voided_at = COALESCE(voided_at, now())
WHERE id = '33333333-3333-3333-3333-000000004102';

INSERT INTO public.invoice_lines (invoice_id, description, amount, line_type)
SELECT v.invoice_id, v.description, v.amount, 'progress'
FROM (VALUES
  ('33333333-3333-3333-3333-000000004101'::uuid, 'Draft — atrium build progress', 8000::numeric),
  ('33333333-3333-3333-3333-000000004102', 'Voided duplicate progress bill', 5000)
) AS v(invoice_id, description, amount)
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_lines il
  WHERE il.invoice_id = v.invoice_id AND il.description = v.description
);

-- 3c) Billing alert on aged wedding invoice (if present)
INSERT INTO public.billing_alerts (
  id, invoice_id, customer_id, from_bucket, to_bucket, outstanding_amount, channel
)
SELECT
  'f1000000-0000-4000-8000-000000000001',
  '33333333-3333-3333-3333-333333333310',
  '11111111-1111-1111-1111-111111111104',
  '61-90', '90+', 21000, 'in_app'
WHERE EXISTS (
  SELECT 1 FROM public.invoices WHERE id = '33333333-3333-3333-3333-333333333310'
)
ON CONFLICT (id) DO NOTHING;

-- 3d) Customer approval items — ensure every major checkpoint type exists
INSERT INTO public.customer_approval_items (
  id, contract_id, checkpoint_type, title, item_key, version,
  supporting_info, due_date, status, created_by, sent_at
) VALUES
(
  'b1000000-0000-4000-8000-000000000030',
  '22222222-2222-2222-2222-222222222230',
  'major_vendors',
  'Approve primary AV + catering vendors',
  'vendors-primary',
  1,
  'BrightStage AV and Premier Catering proposed as principal vendors for the leadership conference.',
  '2026-08-15', 'pending', 'Emily Gray', now()
),
(
  'b1000000-0000-4000-8000-000000000031',
  '22222222-2222-2222-2222-222222222230',
  'final_run_of_show',
  'Approve final run-of-show (day 1–2)',
  'ros-final',
  1,
  'Minute-by-minute show flow including keynote, breakouts, and closing town-hall.',
  '2026-09-01', 'draft', 'Emily Gray', NULL
),
(
  'b1000000-0000-4000-8000-000000000032',
  '22222222-2222-2222-2222-222222222231',
  'cancellation',
  'Acknowledge cancellation policy reminder',
  'cancel-policy',
  1,
  'Confirm understanding of 20%/40% cancellation fee schedule for the holiday reception.',
  '2026-08-25', 'pending', 'Emily Gray', now()
),
(
  'b1000000-0000-4000-8000-000000000033',
  '22222222-2222-2222-2222-222222222204',
  'contract_value_increase',
  'Approve LED wall CO (+$8,500)',
  'cvi-led-wall',
  1,
  'Formal customer approval for contract value increase tied to CO-001 LED wall day.',
  '2026-03-20', 'approved', 'Sam Okonkwo', '2026-03-16T12:00:00+00'
),
(
  'b1000000-0000-4000-8000-000000000034',
  '22222222-2222-2222-2222-222222222204',
  'major_vendors',
  'Approve production vendor shortlist (v1)',
  'vendors-launch',
  1,
  'Initial shortlist — customer requested alternate lighting house.',
  '2026-02-10', 'superseded', 'Sam Okonkwo', '2026-02-01T12:00:00+00'
),
(
  'b1000000-0000-4000-8000-000000000035',
  '22222222-2222-2222-2222-222222222204',
  'major_vendors',
  'Approve production vendor shortlist (v2)',
  'vendors-launch',
  2,
  'Updated shortlist including alternate lighting house per customer request.',
  '2026-02-20', 'approved', 'Sam Okonkwo', '2026-02-12T12:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_approval_decisions (
  id, approval_item_id, decision, comments, customer_contact, decided_at, approved_version
) VALUES
(
  'c1000000-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000033',
  'approved',
  'LED wall add is approved — please issue CO paperwork.',
  'Casey Customer',
  '2026-03-18T15:00:00+00',
  1
),
(
  'c1000000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000034',
  'changes_requested',
  'Please include an alternate lighting house before we approve.',
  'Casey Customer',
  '2026-02-05T11:00:00+00',
  1
),
(
  'c1000000-0000-4000-8000-000000000012',
  'b1000000-0000-4000-8000-000000000035',
  'approved',
  'v2 shortlist looks good.',
  'Casey Customer',
  '2026-02-18T09:30:00+00',
  2
)
ON CONFLICT (id) DO NOTHING;

-- 3e) Contract modification line detail for Physician Conference CO
INSERT INTO public.contract_modification_line_items (
  id, modification_id, contract_id, action, description, quantity, unit_rate, amount_change, sort_order
)
SELECT
  'e1000000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10',
  '22222222-2222-2222-2222-222222222203',
  'add',
  'CME recording package (multi-camera + edit)',
  1, 20000, 20000, 1
WHERE EXISTS (
  SELECT 1 FROM public.contract_modifications
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10'
)
ON CONFLICT (id) DO NOTHING;

-- 3f) Sample AR ledger rows for first historical invoice (audit trail)
INSERT INTO public.ar_ledger_entries (invoice_id, entry_type, debit, credit, memo)
SELECT i.id, v.entry_type,
       CASE WHEN v.entry_type = 'invoice_issue' THEN i.total ELSE 0 END,
       CASE WHEN v.entry_type = 'payment_apply' THEN i.total ELSE 0 END,
       v.memo
FROM public.invoices i
CROSS JOIN (VALUES
  ('invoice_issue'::text, 'AR debit / revenue — historical recognition'::text),
  ('payment_apply', 'Payment applied — historical')
) AS v(entry_type, memo)
WHERE i.id = '33333333-3333-3333-3333-000000004000'
  AND NOT EXISTS (
    SELECT 1 FROM public.ar_ledger_entries e
    WHERE e.invoice_id = i.id AND e.entry_type = v.entry_type AND e.memo = v.memo
  );

-- 3g) Contract approvals + audit events on a historical contract
INSERT INTO public.contract_approvals (
  id, contract_id, action, from_status, to_status, actor_label, actor_role, comments, acted_at
) VALUES
(
  'd1000000-0000-4000-8000-000000000001',
  '22222222-2222-2222-2222-000000003000',
  'submit', 'draft', 'pending_approval', 'Alex Rivera', 'project_manager',
  'Submit historical contract for approval', '2023-07-15T10:00:00+00'
),
(
  'd1000000-0000-4000-8000-000000000002',
  '22222222-2222-2222-2222-000000003000',
  'approve', 'pending_approval', 'approved', 'Elena Executive', 'executive',
  'Approved for production', '2023-07-16T14:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contract_audit_events (
  id, contract_id, event_type, summary, actor_label, from_status, to_status, payload
) VALUES
(
  'd2000000-0000-4000-8000-000000000001',
  '22222222-2222-2222-2222-000000003000',
  'status_change',
  'Historical seed contract activated',
  'system',
  'approved',
  'active',
  '{"source":"seed-hist"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3h) Work deliverable + assignment sample on first historical event
INSERT INTO public.contract_deliverables (
  id, contract_id, code, title, description, phase, location,
  scheduled_start, scheduled_end, status, sort_order, is_performance_obligation
)
SELECT
  'cccccccc-cccc-cccc-cccc-00000000c300',
  '22222222-2222-2222-2222-000000003000',
  'HIST-EXEC',
  'Historical show call',
  'Seed deliverable for progress-tracker demos on historical events',
  'execution',
  'MainEvent Venue 1',
  '2023-09-12 08:00:00+00',
  '2023-09-12 22:00:00+00',
  'completed',
  1,
  true
WHERE EXISTS (
  SELECT 1 FROM public.contracts WHERE id = '22222222-2222-2222-2222-000000003000'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.work_assignments (
  id, contract_id, deliverable_id, assignee_party_id, title, instructions, location,
  scheduled_start, scheduled_end, status
) VALUES (
  'dddddddd-dddd-dddd-dddd-000000003000',
  '22222222-2222-2222-2222-000000003000',
  'cccccccc-cccc-cccc-cccc-00000000c300',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'Historical floor lead',
  'Seed assignment',
  'MainEvent Venue 1',
  '2023-09-12 08:00:00+00',
  '2023-09-12 22:00:00+00',
  'completed'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.work_completions (
  id, assignment_id, performed_by_party_id, checked_in_at, completed_at, work_notes
) VALUES (
  'eeeeeeee-eeee-eeee-eeee-000000003000',
  'dddddddd-dddd-dddd-dddd-000000003000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  '2023-09-12 07:50:00+00',
  '2023-09-12 22:10:00+00',
  'Historical event delivered (seed).'
)
ON CONFLICT (id) DO NOTHING;

-- 3i) Billable cost + classification sample on a historical contract (GAAP views)
INSERT INTO public.billable_costs (
  id, contract_id, customer_id, incurred_date, description, cost_amount,
  markup_percent, is_reimbursable
)
SELECT
  '77777777-7777-7777-7777-000000003000',
  '22222222-2222-2222-2222-000000003000',
  c.customer_id,
  '2023-09-10',
  'Client-directed courier (passthrough)',
  450,
  0,
  true
FROM public.contracts c
WHERE c.id = '22222222-2222-2222-2222-000000003000'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cost_classifications (
  id, cost_ref_id, cost_source, contract_id, classification, period, amount, notes
) VALUES (
  'cccccccc-cccc-cccc-cccc-00000000cc01',
  '77777777-7777-7777-7777-000000003000',
  'billable_costs',
  '22222222-2222-2222-2222-000000003000',
  'reimbursable_passthrough',
  '2023-09-01',
  450,
  'Historical GAAP classification sample'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Sanity comment for operators
-- ---------------------------------------------------------------------------
COMMENT ON FUNCTION public._seed_season_mult(int) IS
  'Seed-only seasonal multiplier used by 20260806120000_comprehensive_seed_historical_ml.';
