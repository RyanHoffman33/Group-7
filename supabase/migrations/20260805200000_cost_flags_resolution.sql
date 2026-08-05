-- Cost flags resolution workflow (audit-preserving).
-- Boolean flag_* columns stay true after resolve; resolution is recorded separately.
--
-- Ownership reminder:
--   - Amount authority (>= $2500) lives in Approvals (approval_status), not Flags queue.
--   - Control exceptions (duplicate invoice, over budget, commitment variance, no
--     commitment, after-billing / late entry) live in Flags.
--   - Open Flags lists should exclude pending_approval rows (app-side filter).
--
-- Note: v_profit_exceptions flagged_cost_entry should also exclude rows where
-- flags_resolved_at IS NOT NULL. Prefer app-side filtering until that view is refreshed.

ALTER TABLE public.cost_entries
  ADD COLUMN IF NOT EXISTS flags_resolved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS flags_resolved_by text NULL,
  ADD COLUMN IF NOT EXISTS flags_resolution_note text NULL;

-- Allow flags_resolved in cost_entry_history.action
ALTER TABLE public.cost_entry_history
  DROP CONSTRAINT IF EXISTS cost_entry_history_action_check;

ALTER TABLE public.cost_entry_history
  ADD CONSTRAINT cost_entry_history_action_check
  CHECK (action = ANY (ARRAY[
    'created'::text,
    'updated'::text,
    'approved'::text,
    'rejected'::text,
    'actualized'::text,
    'flags_resolved'::text
  ]));
