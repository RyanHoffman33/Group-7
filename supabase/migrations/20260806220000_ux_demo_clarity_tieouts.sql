-- UX / demo clarity: Demo Customer naming, PO1 deposit/cancel alignment,
-- aging view status sync, Harborview deposit apply (no double AR+unearned).
-- Additive only — no DROP of teammate objects; historical ML seed untouched.

-- 1) Sync v_ar_outstanding with contracts / GAAP open-AR status set
CREATE OR REPLACE VIEW public.v_ar_outstanding
WITH (security_invoker = true) AS
SELECT
  i.id AS invoice_id,
  i.invoice_number,
  i.customer_id,
  i.contract_id,
  i.due_date,
  i.status,
  i.recognition_status,
  i.billing_method,
  i.total,
  COALESCE(SUM(pa.amount), 0) AS amount_paid,
  i.total - COALESCE(SUM(pa.amount), 0) AS outstanding
FROM public.invoices i
LEFT JOIN payment_applications pa ON pa.invoice_id = i.id
WHERE i.status = ANY (ARRAY['issued'::text, 'unpaid'::text, 'partially_paid'::text, 'disputed'::text])
GROUP BY i.id
HAVING (i.total - COALESCE(SUM(pa.amount), 0)) > 0::numeric;

-- 2) Rename remaining Delta event names on Demo Customer contracts
UPDATE public.contracts
SET event_name = 'Demo Customer Leadership Conference',
    updated_at = now()
WHERE id = '22222222-2222-2222-2222-222222222230'
  AND event_name ILIKE '%Delta%Leadership%';

UPDATE public.contracts
SET event_name = 'Demo Customer Holiday Reception',
    updated_at = now()
WHERE id = '22222222-2222-2222-2222-222222222231'
  AND event_name ILIKE '%Delta%Holiday%';

UPDATE public.contracts
SET event_name = 'Demo Customer Product Launch Night',
    updated_at = now()
WHERE id = 'e3333333-3333-3333-3333-333333333301'
  AND event_name ILIKE '%Delta%Product%';

UPDATE public.contracts
SET event_name = 'Demo Customer Spring Client Workshop',
    updated_at = now()
WHERE id = '22222222-2222-2222-2222-222222222232'
  AND event_name ILIKE '%Delta%Spring%';

-- 3) Align deposit / cancel fee with PO #1 (requiredDepositAmount uses min or %)
-- Leadership: CV 50k, PO1 15k
UPDATE public.contracts
SET minimum_deposit_amount = 15000,
    deposit_percent = 30,
    cancellation_fee_percent = 30,
    updated_at = now()
WHERE id = '22222222-2222-2222-2222-222222222230';

-- Holiday: CV 22k, PO1 7k
UPDATE public.contracts
SET minimum_deposit_amount = 7000,
    deposit_percent = ROUND((7000::numeric / 22000) * 100, 2),
    cancellation_fee_percent = ROUND((7000::numeric / 22000) * 100, 2),
    updated_at = now()
WHERE id = '22222222-2222-2222-2222-222222222231';

-- Soft-rename engagement inquiry display names still saying Delta (if present)
UPDATE public.engagement_inquiries
SET organization = 'Demo Customer',
    event_name = CASE
      WHEN event_name ILIKE '%Spring Leadership%' THEN 'Demo Customer Spring Leadership Summit'
      WHEN event_name ILIKE '%Appreciation Gala%' THEN 'Demo Customer Client Appreciation Gala'
      WHEN event_name ILIKE '%Product Launch%' THEN 'Demo Customer Product Launch Night'
      ELSE event_name
    END
WHERE organization ILIKE 'Delta%'
   OR event_name ILIKE 'Delta%';

-- Soft-rename RFQ titles that still say Delta
UPDATE public.vendor_rfqs
SET title = replace(title, 'Delta', 'Demo Customer'),
    message = replace(COALESCE(message, ''), 'Delta', 'Demo Customer')
WHERE title ILIKE '%Delta%' OR COALESCE(message, '') ILIKE '%Delta%';

UPDATE public.engagement_notifications
SET title = replace(title, 'Delta', 'Demo Customer'),
    body = replace(body, 'Delta', 'Demo Customer')
WHERE title ILIKE '%Delta%' OR body ILIKE '%Delta%';

-- 4) Harborview: clear open AR on deposit invoice by applying remaining unearned deposit
-- INV-2026-0027: $20,100 billed, $10,000 already applied → apply $10,100 deposit remainder
DO $$
DECLARE
  v_deposit_id uuid := '44444444-4444-4444-4444-444444444421';
  v_invoice_id uuid := '33333333-3333-3333-3333-333333333327';
  v_customer_id uuid;
  v_contract_id uuid;
  v_outstanding numeric;
  v_apply numeric;
  v_payment_id uuid;
BEGIN
  SELECT customer_id, contract_id INTO v_customer_id, v_contract_id
  FROM public.deposits
  WHERE id = v_deposit_id AND status = 'unearned';

  IF v_customer_id IS NULL THEN
    RETURN;
  END IF;

  SELECT i.total - COALESCE((
    SELECT SUM(pa.amount) FROM public.payment_applications pa WHERE pa.invoice_id = i.id
  ), 0)
  INTO v_outstanding
  FROM public.invoices i
  WHERE i.id = v_invoice_id;

  v_apply := LEAST(20100::numeric, GREATEST(v_outstanding, 0));
  IF v_apply <= 0 THEN
    UPDATE public.deposits
    SET status = 'applied', applied_to_invoice_id = v_invoice_id
    WHERE id = v_deposit_id AND status = 'unearned';
    RETURN;
  END IF;

  INSERT INTO public.payments (customer_id, amount, paid_at, method, reference)
  VALUES (
    v_customer_id,
    v_apply,
    CURRENT_DATE,
    'deposit_apply',
    'DEPOSIT-' || substr(v_deposit_id::text, 1, 8)
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.payment_applications (payment_id, invoice_id, amount)
  VALUES (v_payment_id, v_invoice_id, v_apply);

  UPDATE public.deposits
  SET status = 'applied', applied_to_invoice_id = v_invoice_id
  WHERE id = v_deposit_id;

  INSERT INTO public.ar_ledger_entries (invoice_id, entry_type, debit, credit, memo)
  VALUES (
    v_invoice_id,
    'deposit_apply',
    0,
    v_apply,
    'Unearned deposit applied against AR (Harborview demo integrity)'
  );

  UPDATE public.invoices
  SET status = CASE
    WHEN (total - COALESCE((
      SELECT SUM(pa.amount) FROM public.payment_applications pa WHERE pa.invoice_id = invoices.id
    ), 0)) <= 0.001 THEN 'paid'
    ELSE 'partially_paid'
  END
  WHERE id = v_invoice_id;
END $$;
