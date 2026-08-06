-- Link ASC 606 performance obligations to contract service line keys.
-- Project: ACCY628-FINAL-PROJECT (eslwjydxevrdgeiqkwtq)

ALTER TABLE public.contract_performance_obligations
  ADD COLUMN IF NOT EXISTS service_keys text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.contract_performance_obligations.service_keys IS
  'Stable service line keys (e.g. svc-0) covered by this performance obligation.';
