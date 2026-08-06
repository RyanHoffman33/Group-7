-- Rename Delta Consulting → Demo Customer in place (same id keeps contract FKs).
-- Portal login customer@gmail.com resolves org "Demo Customer" → this row.

UPDATE public.customers
SET
  name = 'Demo Customer',
  billing_email = 'customer@gmail.com',
  status = 'active'
WHERE id = '11111111-1111-1111-1111-111111111108';

-- If an orphan Demo Customer row was created earlier, merge then delete it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = '22222222-2222-2222-2222-222222222201'
  ) THEN
    UPDATE public.contracts
      SET customer_id = '11111111-1111-1111-1111-111111111108'
      WHERE customer_id = '22222222-2222-2222-2222-222222222201';
    UPDATE public.engagement_inquiries
      SET customer_id = '11111111-1111-1111-1111-111111111108'
      WHERE customer_id = '22222222-2222-2222-2222-222222222201';
    UPDATE public.invoices
      SET customer_id = '11111111-1111-1111-1111-111111111108'
      WHERE customer_id = '22222222-2222-2222-2222-222222222201';
    UPDATE public.deposits
      SET customer_id = '11111111-1111-1111-1111-111111111108'
      WHERE customer_id = '22222222-2222-2222-2222-222222222201';
    UPDATE public.payments
      SET customer_id = '11111111-1111-1111-1111-111111111108'
      WHERE customer_id = '22222222-2222-2222-2222-222222222201';
    DELETE FROM public.customers
      WHERE id = '22222222-2222-2222-2222-222222222201';
  END IF;
END $$;
