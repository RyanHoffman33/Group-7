-- Expand Cost & Resource categories to full ACCY 5.4 list.
ALTER TABLE public.cost_entries DROP CONSTRAINT IF EXISTS cost_entries_category_check;
ALTER TABLE public.cost_budgets DROP CONSTRAINT IF EXISTS cost_budgets_category_check;

ALTER TABLE public.cost_entries ADD CONSTRAINT cost_entries_category_check CHECK (
  category = ANY (ARRAY[
    'labor'::text,
    'payroll'::text,
    'contractor'::text,
    'materials'::text,
    'equipment'::text,
    'vendor'::text,
    'advertising'::text,
    'travel'::text,
    'reimbursable'::text,
    'replacement_parts'::text,
    'allocated'::text,
    'other'::text
  ])
);

ALTER TABLE public.cost_budgets ADD CONSTRAINT cost_budgets_category_check CHECK (
  category = ANY (ARRAY[
    'labor'::text,
    'payroll'::text,
    'contractor'::text,
    'materials'::text,
    'equipment'::text,
    'vendor'::text,
    'advertising'::text,
    'travel'::text,
    'reimbursable'::text,
    'replacement_parts'::text,
    'allocated'::text,
    'other'::text
  ])
);
