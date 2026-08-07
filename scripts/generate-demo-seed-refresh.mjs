/**
 * Generates demo seed refresh migrations under supabase/migrations/.
 * Run: node scripts/generate-demo-seed-refresh.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mig = path.join(root, "supabase", "migrations");

const core = `-- ============================================================================
-- DEMO SEED REFRESH (core) — wipe + customers/vendors + 5.5yr historical P&L
-- Project: ACCY628-FINAL-PROJECT (eslwjydxevrdgeiqkwtq)
-- Companion: 20260807090100_demo_seed_refresh_showcase.sql
--
-- WIPE SCOPE: seed contracts (22222222-*, e3333333-*, Final Presentation UUID),
--   seed engagement e1111111-*, and dependent transactional rows.
-- PRESERVES: schema, gaap_policies, work_parties, practice inquiry c002edce-…
-- HISTORY: Jan 2021 – Jul 2026, 2 closed events/month (134), ~9% YoY, GM ~18–32%
-- ============================================================================

CREATE OR REPLACE FUNCTION public._seed_season_mult(m int)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE m
    WHEN 1 THEN 0.82::numeric WHEN 2 THEN 0.88 WHEN 3 THEN 1.05
    WHEN 4 THEN 1.10 WHEN 5 THEN 1.18 WHEN 6 THEN 1.14
    WHEN 7 THEN 0.96 WHEN 8 THEN 0.98 WHEN 9 THEN 1.08
    WHEN 10 THEN 1.12 WHEN 11 THEN 1.20 WHEN 12 THEN 1.28
    ELSE 1.0 END;
$$;

DO $$
DECLARE
  seed_contract_ids uuid[];
  seed_inquiry_ids uuid[] := ARRAY[
    'e1111111-1111-1111-1111-111111111101'::uuid,
    'e1111111-1111-1111-1111-111111111102'::uuid,
    'e1111111-1111-1111-1111-111111111103'::uuid
  ];
BEGIN
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO seed_contract_ids
  FROM public.contracts
  WHERE id::text LIKE '22222222-%'
     OR id::text LIKE 'e3333333-%'
     OR id = '152268fa-b897-444a-b032-8e65dc4d0b93'::uuid
     OR closeout_notes ILIKE '%Historical seed%'
     OR COALESCE(notes, '') ILIKE '%demo seed%'
     OR COALESCE(notes, '') ILIKE '%Historical seed%'
     OR contract_number LIKE 'ME-ENG-%';

  UPDATE public.engagement_inquiries
  SET contract_id = NULL, deposit_id = NULL
  WHERE id = ANY (seed_inquiry_ids)
     OR contract_id = ANY (seed_contract_ids)
     OR deposit_id IN (SELECT id FROM public.deposits WHERE contract_id = ANY (seed_contract_ids));

  DELETE FROM public.customer_vendor_quote_offers WHERE inquiry_id = ANY (seed_inquiry_ids);
  DELETE FROM public.vendor_quotes
  WHERE rfq_id IN (SELECT id FROM public.vendor_rfqs WHERE inquiry_id = ANY (seed_inquiry_ids));
  DELETE FROM public.vendor_rfqs WHERE inquiry_id = ANY (seed_inquiry_ids);
  DELETE FROM public.engagement_signatures WHERE inquiry_id = ANY (seed_inquiry_ids);
  DELETE FROM public.engagement_notifications WHERE inquiry_id = ANY (seed_inquiry_ids);
  DELETE FROM public.company_quotes WHERE inquiry_id = ANY (seed_inquiry_ids);
  DELETE FROM public.engagement_inquiries WHERE id = ANY (seed_inquiry_ids);

  UPDATE public.contract_performance_obligations
  SET installment_deposit_id = NULL, invoice_id = NULL, recognition_evidence_id = NULL
  WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.po_approvals WHERE contract_id = ANY (seed_contract_ids);

  DELETE FROM public.payment_applications
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE contract_id = ANY (seed_contract_ids))
     OR payment_id::text LIKE '55555555-%';
  DELETE FROM public.payment_drafts
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.billing_alerts
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.ar_ledger_entries
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.ar_bucket_state
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE contract_id = ANY (seed_contract_ids));

  UPDATE public.billable_time_entries SET billed_invoice_id = NULL WHERE contract_id = ANY (seed_contract_ids);
  UPDATE public.billable_costs SET billed_invoice_id = NULL WHERE contract_id = ANY (seed_contract_ids);
  UPDATE public.contract_milestones SET billed_invoice_id = NULL WHERE contract_id = ANY (seed_contract_ids);

  DELETE FROM public.recognition_evidence WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.invoice_lines
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE contract_id = ANY (seed_contract_ids));
  UPDATE public.deposits SET applied_to_invoice_id = NULL WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.deposits WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.invoices WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.invoice_lines WHERE invoice_id::text LIKE '33333333-%';
  DELETE FROM public.invoices WHERE id::text LIKE '33333333-%';
  DELETE FROM public.payments WHERE id::text LIKE '55555555-%'
     OR reference LIKE 'HIST-PMT-%' OR reference LIKE 'DEMO-%'
     OR reference LIKE 'CASCADE-%' OR reference LIKE 'LEADERSHIP-%' OR reference LIKE 'HOLIDAY-%';

  DELETE FROM public.cost_flag_cases
  WHERE cost_entry_id IN (SELECT id FROM public.cost_entries WHERE contract_id = ANY (seed_contract_ids))
     OR kept_cost_entry_id IN (SELECT id FROM public.cost_entries WHERE contract_id = ANY (seed_contract_ids))
     OR voided_cost_entry_id IN (SELECT id FROM public.cost_entries WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.cost_entry_history
  WHERE cost_entry_id IN (SELECT id FROM public.cost_entries WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.cost_entries WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.cost_entries WHERE id::text LIKE 'cccccccc-%' OR entered_by IN ('seed-hist', 'seed-demo');
  DELETE FROM public.cost_budgets WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.cost_classifications WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.billable_costs WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.billable_time_entries WHERE contract_id = ANY (seed_contract_ids);

  DELETE FROM public.work_obligation_resources
  WHERE obligation_id IN (SELECT id FROM public.work_performance_obligations WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.work_time_materials
  WHERE obligation_id IN (SELECT id FROM public.work_performance_obligations WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.work_completions
  WHERE obligation_id IN (SELECT id FROM public.work_performance_obligations WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.work_attachments
  WHERE obligation_id IN (SELECT id FROM public.work_performance_obligations WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.work_performance_obligations WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.work_assignments WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.work_exceptions WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.work_contract_documents WHERE contract_id = ANY (seed_contract_ids);

  DELETE FROM public.customer_approval_decisions
  WHERE approval_item_id IN (SELECT id FROM public.customer_approval_items WHERE contract_id = ANY (seed_contract_ids));
  DELETE FROM public.customer_approval_items WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_involvement_checkpoints WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_performance_obligations WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_modification_line_items
  WHERE modification_id IN (SELECT id FROM public.contract_modifications WHERE contract_id = ANY (seed_contract_ids));
  UPDATE public.contract_documents SET modification_id = NULL WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_modifications WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_documents WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_deliverables WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_line_items WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_milestones WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_approvals WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.contract_audit_events WHERE contract_id = ANY (seed_contract_ids);
  DELETE FROM public.billing_schedules WHERE contract_id = ANY (seed_contract_ids);

  UPDATE public.contracts SET project_manager_party_id = NULL WHERE id = ANY (seed_contract_ids);
  DELETE FROM public.contracts WHERE id = ANY (seed_contract_ids);
END $$;

INSERT INTO public.customers (id, name, billing_email, payment_terms_days, status) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Northstar Industries', 'ap@northstar.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111102', 'Summit Tech Partners', 'billing@summittech.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111103', 'Harborview Medical', 'finance@harborview.example', 45, 'active'),
  ('11111111-1111-1111-1111-111111111104', 'Anderson Family Events', 'anderson@example.com', 15, 'active'),
  ('11111111-1111-1111-1111-111111111105', 'Greenfield Nonprofit', 'events@greenfield.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111106', 'Prairie Arts Collective', 'billing@prairiearts.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111107', 'Lakeside University', 'events@lakesideu.example', 45, 'active'),
  ('11111111-1111-1111-1111-111111111108', 'Demo Customer', 'customer@gmail.com', 30, 'active'),
  ('11111111-1111-1111-1111-111111111110', 'Horizon Biotech', 'ap@horizonbio.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111111', 'Metro Chamber Alliance', 'events@metrochamber.example', 45, 'active'),
  ('11111111-1111-1111-1111-111111111112', 'BrightPath Education', 'finance@brightpath.example', 30, 'active'),
  ('11111111-1111-1111-1111-111111111113', 'Cascade Outdoor Brands', 'billing@cascadeob.example', 15, 'active'),
  ('11111111-1111-1111-1111-111111111114', 'Riverbend Hospitality', 'ap@riverbend.example', 30, 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, billing_email = EXCLUDED.billing_email,
  payment_terms_days = EXCLUDED.payment_terms_days, status = EXCLUDED.status;

INSERT INTO public.customer_payment_stats
  (customer_id, avg_days_to_pay, on_time_rate, sample_size, bucket_survival) VALUES
  ('11111111-1111-1111-1111-111111111101', 22, 0.88, 40, '{"current":1.0,"1-30":0.96,"31-60":0.90,"61-90":0.84,"90+":0.75}'::jsonb),
  ('11111111-1111-1111-1111-111111111102', 18, 0.91, 36, '{"current":1.0,"1-30":0.97,"31-60":0.92,"61-90":0.86,"90+":0.78}'::jsonb),
  ('11111111-1111-1111-1111-111111111103', 35, 0.72, 28, '{"current":1.0,"1-30":0.92,"31-60":0.84,"61-90":0.74,"90+":0.60}'::jsonb),
  ('11111111-1111-1111-1111-111111111104', 12, 0.95, 20, '{"current":1.0,"1-30":0.99,"31-60":0.96,"61-90":0.93,"90+":0.90}'::jsonb),
  ('11111111-1111-1111-1111-111111111105', 28, 0.80, 24, '{"current":1.0,"1-30":0.94,"31-60":0.88,"61-90":0.80,"90+":0.70}'::jsonb),
  ('11111111-1111-1111-1111-111111111106', 25, 0.84, 18, '{"current":1.0,"1-30":0.95,"31-60":0.89,"61-90":0.82,"90+":0.72}'::jsonb),
  ('11111111-1111-1111-1111-111111111107', 20, 0.90, 22, '{"current":1.0,"1-30":0.97,"31-60":0.93,"61-90":0.88,"90+":0.80}'::jsonb),
  ('11111111-1111-1111-1111-111111111108', 16, 0.93, 30, '{"current":1.0,"1-30":0.98,"31-60":0.94,"61-90":0.90,"90+":0.85}'::jsonb),
  ('11111111-1111-1111-1111-111111111110', 18, 0.92, 24, '{"current":1.0,"1-30":0.97,"31-60":0.93,"61-90":0.88,"90+":0.80}'::jsonb),
  ('11111111-1111-1111-1111-111111111111', 28, 0.78, 20, '{"current":1.0,"1-30":0.94,"31-60":0.88,"61-90":0.80,"90+":0.70}'::jsonb),
  ('11111111-1111-1111-1111-111111111112', 14, 0.96, 18, '{"current":1.0,"1-30":0.99,"31-60":0.96,"61-90":0.92,"90+":0.88}'::jsonb),
  ('11111111-1111-1111-1111-111111111113', 35, 0.60, 16, '{"current":1.0,"1-30":0.90,"31-60":0.82,"61-90":0.72,"90+":0.55}'::jsonb),
  ('11111111-1111-1111-1111-111111111114', 21, 0.86, 14, '{"current":1.0,"1-30":0.95,"31-60":0.90,"61-90":0.84,"90+":0.76}'::jsonb)
ON CONFLICT (customer_id) DO UPDATE SET
  avg_days_to_pay = EXCLUDED.avg_days_to_pay, on_time_rate = EXCLUDED.on_time_rate,
  sample_size = EXCLUDED.sample_size, bucket_survival = EXCLUDED.bucket_survival, updated_at = now();

INSERT INTO public.vendors (id, name, portal_email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Premier Catering Co', 'vendor@gmail.com'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'StageRight AV', 'vendor@gmail.com'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Fleet Travel Partners', NULL),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'BrightLight Rentals', NULL),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'Bloom & Branch Florals', NULL),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'SoundWave Production', NULL),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'City Permit Desk', NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  portal_email = COALESCE(EXCLUDED.portal_email, public.vendors.portal_email);

-- ========== Historical generator helper view (temp via CTE only) ==========
-- Contracts
WITH months AS (
  SELECT gs::date AS month_start, (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2021-01-01', DATE '2026-07-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
priced AS (
  SELECT
    s.*,
    ('22222222-2222-2222-2222-' || lpad((5000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    (ARRAY[
      '11111111-1111-1111-1111-111111111101'::uuid,'11111111-1111-1111-1111-111111111102'::uuid,
      '11111111-1111-1111-1111-111111111103'::uuid,'11111111-1111-1111-1111-111111111104'::uuid,
      '11111111-1111-1111-1111-111111111105'::uuid,'11111111-1111-1111-1111-111111111106'::uuid,
      '11111111-1111-1111-1111-111111111107'::uuid,'11111111-1111-1111-1111-111111111108'::uuid,
      '11111111-1111-1111-1111-111111111110'::uuid,'11111111-1111-1111-1111-111111111111'::uuid,
      '11111111-1111-1111-1111-111111111112'::uuid,'11111111-1111-1111-1111-111111111113'::uuid,
      '11111111-1111-1111-1111-111111111114'::uuid
    ])[1 + (s.n % 13)] AS customer_id,
    (ARRAY['corporate_conference','gala','wedding','product_launch','fundraiser','trade_show','holiday_party','corporate_event'])[1 + (s.n % 8)] AS event_type,
    (ARRAY['fixed_price','milestone','progress','fixed_price','retainer','fixed_price'])[1 + (s.n % 6)] AS billing_method,
    (ARRAY['collaborative','collaborative','full_service','custom','collaborative'])[1 + (s.n % 5)] AS involvement_model,
    (ARRAY['Alex Rivera','Jordan Blake','Morgan Ellis','Sam Okonkwo','Emily Gray'])[1 + (s.n % 5)] AS pm_label,
    (ARRAY['Chicago','Seattle','Austin','Madison','Napa','Richmond','Denver','Boston'])[1 + (s.n % 8)] AS venue_city,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    greatest(round(
      (40000 + s.event_slot * 14000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * power(1.0072::numeric, s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 17) - 8)::numeric / 100))
      / 100
    ) * 100, 22000)::numeric AS cv,
    CASE
      WHEN s.n % 41 = 11 THEN 1.08
      WHEN s.n % 17 = 5 THEN 0.88
      WHEN s.n % 11 = 3 THEN 0.68
      ELSE 0.74 + ((s.n % 5)::numeric * 0.01)
    END AS cogs_ratio
  FROM slots s
)
INSERT INTO public.contracts (
  id, customer_id, contract_number, event_name, contract_value, original_contract_value,
  deposit_required, deposit_percent, status, performance_complete, approved_at,
  billing_method, event_type, event_start, event_end, venue_name, venue_city,
  guest_count, project_manager_label, approved_by, completed_at, closed_at,
  closeout_notes, change_order_value_total, progress_percent, involvement_model,
  currency, activated_at, terms_locked_at
)
SELECT
  contract_id, customer_id,
  'ME-' || to_char(event_day, 'YYYY') || '-' || lpad((5000 + n)::text, 4, '0'),
  initcap(replace(event_type, '_', ' ')) || ' — ' || to_char(month_start, 'Mon YYYY')
    || CASE event_slot WHEN 0 THEN ' A' ELSE ' B' END,
  cv, cv, true, 30, 'closed', true, (event_day - 60)::timestamptz,
  billing_method, event_type,
  (event_day::text || ' 09:00:00+00')::timestamptz,
  (event_day::text || ' 22:00:00+00')::timestamptz,
  'MainEvent Venue ' || (1 + (n % 6))::text, venue_city,
  80 + (n % 20) * 10, pm_label, pm_label,
  (event_day::text || ' 23:00:00+00')::timestamptz, (event_day + 14)::timestamptz,
  'Historical seed event — closed after final collection (ML series).',
  0, 100, involvement_model, 'USD',
  (event_day - 45)::timestamptz, (event_day - 60)::timestamptz
FROM priced
ON CONFLICT (id) DO UPDATE SET
  contract_value = EXCLUDED.contract_value, status = EXCLUDED.status,
  event_start = EXCLUDED.event_start, event_end = EXCLUDED.event_end,
  completed_at = EXCLUDED.completed_at, closed_at = EXCLUDED.closed_at;

WITH months AS (
  SELECT gs::date AS month_start, (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2021-01-01', DATE '2026-07-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
priced AS (
  SELECT
    s.n,
    ('22222222-2222-2222-2222-' || lpad((5000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('33333333-3333-3333-3333-' || lpad((5000 + s.n)::text, 12, '0'))::uuid AS invoice_id,
    (ARRAY[
      '11111111-1111-1111-1111-111111111101'::uuid,'11111111-1111-1111-1111-111111111102'::uuid,
      '11111111-1111-1111-1111-111111111103'::uuid,'11111111-1111-1111-1111-111111111104'::uuid,
      '11111111-1111-1111-1111-111111111105'::uuid,'11111111-1111-1111-1111-111111111106'::uuid,
      '11111111-1111-1111-1111-111111111107'::uuid,'11111111-1111-1111-1111-111111111108'::uuid,
      '11111111-1111-1111-1111-111111111110'::uuid,'11111111-1111-1111-1111-111111111111'::uuid,
      '11111111-1111-1111-1111-111111111112'::uuid,'11111111-1111-1111-1111-111111111113'::uuid,
      '11111111-1111-1111-1111-111111111114'::uuid
    ])[1 + (s.n % 13)] AS customer_id,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    greatest(round(
      (40000 + s.event_slot * 14000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * power(1.0072::numeric, s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 17) - 8)::numeric / 100))
      / 100
    ) * 100, 22000)::numeric AS cv
  FROM slots s
)
INSERT INTO public.invoices (
  id, contract_id, customer_id, invoice_number, issue_date, due_date,
  subtotal, tax, total, status, recognition_status, milestone_key, created_by, billing_method
)
SELECT invoice_id, contract_id, customer_id,
  'INV-HIST-' || lpad((5000 + n)::text, 4, '0'),
  event_day - 3, event_day + 27, cv, 0, cv, 'paid', 'recognized',
  'hist-final-' || n::text, 'seed-hist', 'fixed_price'
FROM priced
ON CONFLICT (id) DO UPDATE SET
  total = EXCLUDED.total, status = EXCLUDED.status, recognition_status = EXCLUDED.recognition_status;

INSERT INTO public.invoice_lines (invoice_id, description, amount, performance_obligation_ref, line_type)
SELECT i.id, 'Historical event delivery — full settlement', i.total, 'PO-event', 'fixed'
FROM public.invoices i
WHERE i.id::text LIKE '33333333-3333-3333-3333-000000005%'
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_lines il
    WHERE il.invoice_id = i.id AND il.description = 'Historical event delivery — full settlement'
  );

INSERT INTO public.recognition_evidence (
  id, contract_id, invoice_id, evidence_type, evidence_date, description, supporting_ref, created_by
)
SELECT
  ('aaaaaaaa-aaaa-aaaa-aaaa-' || lpad((5000 + n)::text, 12, '0'))::uuid,
  c.id, i.id, 'event_completion', c.event_start::date,
  'Historical event completed; client sign-off on file',
  'DOC-HIST-' || lpad((5000 + n)::text, 4, '0'), 'seed-hist'
FROM generate_series(0, 133) AS n
JOIN public.contracts c ON c.id = ('22222222-2222-2222-2222-' || lpad((5000 + n)::text, 12, '0'))::uuid
JOIN public.invoices i ON i.id = ('33333333-3333-3333-3333-' || lpad((5000 + n)::text, 12, '0'))::uuid
ON CONFLICT (id) DO UPDATE SET evidence_date = EXCLUDED.evidence_date;

INSERT INTO public.payments (id, customer_id, amount, paid_at, method, reference)
SELECT
  ('55555555-5555-5555-5555-' || lpad((5000 + n)::text, 12, '0'))::uuid,
  i.customer_id, i.total, (c.event_start::date + 10),
  CASE WHEN n % 3 = 0 THEN 'wire' WHEN n % 3 = 1 THEN 'ach' ELSE 'check' END,
  'HIST-PMT-' || lpad((5000 + n)::text, 4, '0')
FROM generate_series(0, 133) AS n
JOIN public.invoices i ON i.id = ('33333333-3333-3333-3333-' || lpad((5000 + n)::text, 12, '0'))::uuid
JOIN public.contracts c ON c.id = i.contract_id
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, paid_at = EXCLUDED.paid_at;

INSERT INTO public.payment_applications (payment_id, invoice_id, amount)
SELECT
  ('55555555-5555-5555-5555-' || lpad((5000 + n)::text, 12, '0'))::uuid,
  ('33333333-3333-3333-3333-' || lpad((5000 + n)::text, 12, '0'))::uuid,
  i.total
FROM generate_series(0, 133) AS n
JOIN public.invoices i ON i.id = ('33333333-3333-3333-3333-' || lpad((5000 + n)::text, 12, '0'))::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_applications pa
  WHERE pa.payment_id = ('55555555-5555-5555-5555-' || lpad((5000 + n)::text, 12, '0'))::uuid
    AND pa.invoice_id = i.id
);

-- Budgets sized slightly above expected COGS so only intentional overruns flag
WITH months AS (
  SELECT gs::date AS month_start, (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2021-01-01', DATE '2026-07-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
priced AS (
  SELECT
    s.n,
    ('22222222-2222-2222-2222-' || lpad((5000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    greatest(round(
      (40000 + s.event_slot * 14000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * power(1.0072::numeric, s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 17) - 8)::numeric / 100))
      / 100
    ) * 100, 22000)::numeric AS cv,
    CASE
      WHEN s.n % 41 = 11 THEN 1.08
      WHEN s.n % 17 = 5 THEN 0.88
      WHEN s.n % 11 = 3 THEN 0.68
      ELSE 0.74 + ((s.n % 5)::numeric * 0.01)
    END AS cogs_ratio
  FROM slots s
)
INSERT INTO public.cost_budgets (contract_id, category, budgeted_amount)
SELECT contract_id, cat, amt
FROM priced p
CROSS JOIN LATERAL (
  SELECT round(p.cv * p.cogs_ratio * 1.04, 2) AS tot
) t
CROSS JOIN LATERAL (VALUES
  ('labor'::text, round(t.tot * 0.35, 2)),
  ('vendor', round(t.tot * 0.45, 2)),
  ('equipment', round(t.tot * 0.20, 2))
) AS v(cat, amt)
ON CONFLICT (contract_id, category) DO UPDATE SET budgeted_amount = EXCLUDED.budgeted_amount;

WITH months AS (
  SELECT gs::date AS month_start, (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2021-01-01', DATE '2026-07-01', INTERVAL '1 month') AS gs
),
slots AS (
  SELECT m.month_start, m.month_idx, e AS event_slot, (m.month_idx * 2 + e) AS n
  FROM months m CROSS JOIN generate_series(0, 1) AS e
),
priced AS (
  SELECT
    s.n,
    ('22222222-2222-2222-2222-' || lpad((5000 + s.n)::text, 12, '0'))::uuid AS contract_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((60000 + s.n * 3)::text, 12, '0'))::uuid AS cost_labor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((60001 + s.n * 3)::text, 12, '0'))::uuid AS cost_vendor_id,
    ('cccccccc-cccc-cccc-cccc-' || lpad((60002 + s.n * 3)::text, 12, '0'))::uuid AS cost_equip_id,
    (s.month_start + ((12 + s.event_slot * 10)::text || ' days')::interval)::date AS event_day,
    greatest(round(
      (40000 + s.event_slot * 14000)::numeric
      * public._seed_season_mult(EXTRACT(MONTH FROM s.month_start)::int)
      * power(1.0072::numeric, s.month_idx)
      * (1 + (((abs(hashtext(s.month_start::text || '-' || s.event_slot::text)) % 17) - 8)::numeric / 100))
      / 100
    ) * 100, 22000)::numeric AS cv,
    CASE
      WHEN s.n % 41 = 11 THEN 1.08
      WHEN s.n % 17 = 5 THEN 0.88
      WHEN s.n % 11 = 3 THEN 0.68
      ELSE 0.74 + ((s.n % 5)::numeric * 0.01)
    END AS cogs_ratio,
    (ARRAY[
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'::uuid,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6'::uuid
    ])[1 + (s.n % 5)] AS vendor_id,
    (ARRAY['Premier Catering Co','StageRight AV','BrightLight Rentals','Bloom & Branch Florals','SoundWave Production'])[1 + (s.n % 5)] AS vendor_name,
    (ARRAY[
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6'::uuid
    ])[1 + (s.n % 3)] AS equip_vendor_id,
    (ARRAY['StageRight AV','BrightLight Rentals','SoundWave Production'])[1 + (s.n % 3)] AS equip_vendor_name
  FROM slots s
),
with_cogs AS (
  SELECT *, round(cv * cogs_ratio, 2) AS total_cogs,
    -- Intentional overruns for exceptions (~every 29th)
    CASE WHEN n % 29 = 7 THEN 1.12 ELSE 1.0 END AS overrun
  FROM priced
)
INSERT INTO public.cost_entries (
  id, contract_id, entry_type, category, amount, hours, rate, worker_label,
  vendor_id, vendor_name, invoice_ref, commitment_status, approval_status, is_reimbursable,
  notes, entered_by, incurred_date,
  flag_late_entry, flag_over_committed, flag_after_billing
)
SELECT * FROM (
  SELECT
    cost_labor_id, contract_id, 'labor'::text, 'labor'::text,
    round(total_cogs * overrun * 0.35, 2),
    40::numeric, round(total_cogs * overrun * 0.35 / 40, 2), 'Hist Crew Lead'::text,
    NULL::uuid, NULL::text, NULL::text, 'actual'::text, 'approved'::text, false,
    'Historical labor actuals'::text, 'seed-hist'::text, event_day,
    false, false, false
  FROM with_cogs
  UNION ALL
  SELECT
    cost_vendor_id, contract_id, 'vendor_expense', 'vendor',
    round(total_cogs * overrun * 0.45, 2),
    NULL, NULL, NULL,
    vendor_id, vendor_name, 'HIST-V-' || lpad((5000 + n)::text, 4, '0'),
    'actual', 'approved', false,
    'Historical vendor production', 'seed-hist', event_day,
    (n % 37 = 9), (n % 29 = 7), false
  FROM with_cogs
  UNION ALL
  SELECT
    cost_equip_id, contract_id, 'vendor_expense', 'equipment',
    round(total_cogs * overrun * 0.20, 2),
    NULL, NULL, NULL,
    equip_vendor_id, equip_vendor_name, 'HIST-E-' || lpad((5000 + n)::text, 4, '0'),
    'actual', 'not_required', false,
    'Historical equipment rental', 'seed-hist', event_day,
    false, false, (n % 43 = 13)
  FROM with_cogs
) x
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount, incurred_date = EXCLUDED.incurred_date,
  vendor_id = EXCLUDED.vendor_id, vendor_name = EXCLUDED.vendor_name,
  flag_late_entry = EXCLUDED.flag_late_entry,
  flag_over_committed = EXCLUDED.flag_over_committed,
  flag_after_billing = EXCLUDED.flag_after_billing;

INSERT INTO public.cost_entries (
  id, contract_id, entry_type, category, amount, commitment_status, approval_status,
  is_reimbursable, notes, entered_by, incurred_date
)
SELECT
  ('cccccccc-cccc-cccc-cccc-' || lpad((70000 + m.month_idx)::text, 12, '0'))::uuid,
  ('22222222-2222-2222-2222-' || lpad((5000 + (m.month_idx * 2))::text, 12, '0'))::uuid,
  'vendor_expense', 'allocated', 2200 + (m.month_idx % 5) * 120,
  'actual', 'not_required', false,
  'Shared ops overhead allocation (period expense)', 'seed-hist', m.month_start
FROM (
  SELECT gs::date AS month_start, (row_number() OVER (ORDER BY gs) - 1)::int AS month_idx
  FROM generate_series(DATE '2021-01-01', DATE '2026-07-01', INTERVAL '1 month') AS gs
) m
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, incurred_date = EXCLUDED.incurred_date;
`;

fs.writeFileSync(path.join(mig, "20260807090000_demo_seed_refresh_core.sql"), core);
console.log("core bytes", Buffer.byteLength(core));
