-- Allow pending_customer_acceptance for Demo Customer portal proposals.

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check CHECK (
    status = ANY (ARRAY[
      'draft'::text,
      'pending_approval'::text,
      'pending_customer_acceptance'::text,
      'approved'::text,
      'deposit_pending'::text,
      'active'::text,
      'completed'::text,
      'canceled'::text,
      'closed'::text
    ])
  );

DROP INDEX IF EXISTS public.contracts_one_open_event_uidx;

CREATE UNIQUE INDEX contracts_one_open_event_uidx
  ON public.contracts (
    customer_id,
    lower(btrim(event_name)),
    COALESCE((event_start AT TIME ZONE 'UTC')::date, DATE 'epoch')
  )
  WHERE status = ANY (ARRAY[
    'draft'::text,
    'pending_approval'::text,
    'pending_customer_acceptance'::text,
    'approved'::text,
    'deposit_pending'::text,
    'active'::text
  ]);
