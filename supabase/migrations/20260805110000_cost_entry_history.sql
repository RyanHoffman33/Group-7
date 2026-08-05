-- Cost entry audit history + actual-vs-committed flag
ALTER TABLE public.cost_entries
  ADD COLUMN IF NOT EXISTS flag_actual_exceeds_committed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prior_committed_amount numeric NULL;

CREATE TABLE IF NOT EXISTS public.cost_entry_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_entry_id uuid NOT NULL REFERENCES public.cost_entries(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action = ANY (ARRAY[
    'created'::text, 'updated'::text, 'approved'::text, 'rejected'::text, 'actualized'::text
  ])),
  actor text NOT NULL DEFAULT 'system',
  detail text NULL,
  before_snapshot jsonb NULL,
  after_snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_entry_history_entry_idx
  ON public.cost_entry_history (cost_entry_id, created_at DESC);

ALTER TABLE public.cost_entry_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cost_entry_history_demo_all ON public.cost_entry_history;
CREATE POLICY cost_entry_history_demo_all ON public.cost_entry_history
  FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.cost_entry_history TO anon, authenticated;
