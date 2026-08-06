-- Additive: Demo Customer linked to customer portal login (customer@gmail.com).
-- Existing Delta Consulting data is left intact; portal org resolves to Demo Customer.

DO $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id
  FROM public.customers
  WHERE lower(btrim(name)) = lower('Demo Customer')
  LIMIT 1;

  IF existing_id IS NULL THEN
    INSERT INTO public.customers (id, name, billing_email, status)
    VALUES (
      '22222222-2222-2222-2222-222222222201',
      'Demo Customer',
      'customer@gmail.com',
      'active'
    )
    ON CONFLICT (id) DO UPDATE
    SET
      name = EXCLUDED.name,
      billing_email = EXCLUDED.billing_email,
      status = EXCLUDED.status;
  ELSE
    UPDATE public.customers
    SET
      billing_email = 'customer@gmail.com',
      status = 'active',
      name = 'Demo Customer'
    WHERE id = existing_id;
  END IF;
END $$;
