-- Ensure disputed A/R edge case is visible in Billing / Aging demos
UPDATE public.invoices
SET status = 'disputed'
WHERE id = '33333333-3333-3333-3333-333333333309'
  AND status <> 'disputed';
