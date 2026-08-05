-- Approval threshold $2,500 + commitment variance / no-commitment flags
ALTER TABLE public.cost_entries
  ADD COLUMN IF NOT EXISTS flag_no_commitment boolean NOT NULL DEFAULT false;

UPDATE public.cost_entries
SET approval_status = 'not_required'
WHERE approval_status = 'pending_approval'
  AND amount < 2500;

UPDATE public.cost_entries
SET approval_status = 'pending_approval'
WHERE approval_status = 'not_required'
  AND amount >= 2500;

UPDATE public.cost_entries
SET flag_no_commitment = (
  commitment_status = 'actual' AND prior_committed_amount IS NULL
);

UPDATE public.cost_entries
SET flag_actual_exceeds_committed = (
  commitment_status = 'actual'
  AND prior_committed_amount IS NOT NULL
  AND prior_committed_amount > 0
  AND amount > prior_committed_amount
  AND (amount - prior_committed_amount) > LEAST(prior_committed_amount * 0.15, 500)
);
