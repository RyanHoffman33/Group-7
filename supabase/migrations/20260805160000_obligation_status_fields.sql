-- Numbered obligations + assignee / customer contact fields for status cards

ALTER TABLE public.work_performance_obligations
  ADD COLUMN IF NOT EXISTS obligation_number integer,
  ADD COLUMN IF NOT EXISTS assignee_party_id uuid REFERENCES public.work_parties(id),
  ADD COLUMN IF NOT EXISTS customer_contact_name text,
  ADD COLUMN IF NOT EXISTS customer_contact_email text;

-- Assign sequential numbers per contract where missing
WITH numbered AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY contract_id
      ORDER BY sort_order, created_at, code
    ) AS rn
  FROM public.work_performance_obligations
)
UPDATE public.work_performance_obligations o
SET
  obligation_number = numbered.rn,
  sort_order = numbered.rn,
  code = 'PO-' || numbered.rn
FROM numbered
WHERE o.id = numbered.id
  AND (o.obligation_number IS NULL OR o.code !~ '^PO-[0-9]+$');

-- Ensure NOT NULL going forward for new rows (existing filled above)
UPDATE public.work_performance_obligations
SET obligation_number = COALESCE(obligation_number, sort_order, 1)
WHERE obligation_number IS NULL;

ALTER TABLE public.work_performance_obligations
  ALTER COLUMN obligation_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS work_performance_obligations_contract_number_uidx
  ON public.work_performance_obligations (contract_id, obligation_number);

-- Default customer contacts from customers.billing_email for empty rows
UPDATE public.work_performance_obligations o
SET
  customer_contact_name = COALESCE(o.customer_contact_name, cust.name || ' AP'),
  customer_contact_email = COALESCE(o.customer_contact_email, cust.billing_email)
FROM public.contracts c
JOIN public.customers cust ON cust.id = c.customer_id
WHERE o.contract_id = c.id
  AND (o.customer_contact_name IS NULL OR o.customer_contact_email IS NULL);

-- Assign a default crew/vendor party where missing (rotate through crew/vendor)
WITH parties AS (
  SELECT id, row_number() OVER (ORDER BY display_name) AS rn
  FROM public.work_parties
  WHERE party_type IN ('crew', 'vendor') AND active = true
),
obs AS (
  SELECT id, row_number() OVER (ORDER BY contract_id, obligation_number) AS rn
  FROM public.work_performance_obligations
  WHERE assignee_party_id IS NULL
)
UPDATE public.work_performance_obligations o
SET assignee_party_id = p.id
FROM obs
JOIN parties p ON p.rn = ((obs.rn - 1) % (SELECT count(*) FROM parties)) + 1
WHERE o.id = obs.id;

-- Seed minimal supply/cost lines for obligations that have none
INSERT INTO public.work_obligation_resources (
  obligation_id, contract_id, resource_type, label, quantity, unit,
  estimated_unit_cost, export_to_cost
)
SELECT
  o.id,
  o.contract_id,
  'manpower',
  'Assigned crew',
  2,
  'people',
  45,
  true
FROM public.work_performance_obligations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.work_obligation_resources r WHERE r.obligation_id = o.id
);

INSERT INTO public.work_obligation_resources (
  obligation_id, contract_id, resource_type, label, quantity, unit,
  estimated_unit_cost, export_to_cost
)
SELECT
  o.id,
  o.contract_id,
  'supply',
  'Materials / consumables',
  1,
  'lot',
  GREATEST(o.estimated_supply_cost, 75),
  true
FROM public.work_performance_obligations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.work_obligation_resources r
  WHERE r.obligation_id = o.id AND r.resource_type IN ('supply', 'equipment')
);
