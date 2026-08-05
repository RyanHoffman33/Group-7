-- Work & Performance Tracking (ACCY628 Section 5.3)
-- Owned by Work module (Jacob). FK only into public.contracts.
-- contract_deliverables is a temporary gap-fill until Contracts module owns obligations.
-- Role-based RLS deferred — demo-open policies match Billing until Users & Roles lands.

CREATE TABLE IF NOT EXISTS public.work_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  party_type text NOT NULL CHECK (
    party_type = ANY (ARRAY['crew'::text, 'vendor'::text, 'manager'::text, 'client'::text])
  ),
  vendor_org text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  phase text NOT NULL CHECK (
    phase = ANY (ARRAY['planning'::text, 'execution'::text, 'wrapup'::text])
  ),
  location text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text NOT NULL DEFAULT 'promised' CHECK (
    status = ANY (ARRAY[
      'promised'::text,
      'scheduled'::text,
      'in_progress'::text,
      'completed'::text,
      'waived'::text
    ])
  ),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, code)
);

CREATE TABLE IF NOT EXISTS public.work_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.contract_deliverables(id) ON DELETE CASCADE,
  assignee_party_id uuid NOT NULL REFERENCES public.work_parties(id),
  title text NOT NULL,
  instructions text,
  location text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (
    status = ANY (ARRAY[
      'scheduled'::text,
      'checked_in'::text,
      'completed'::text,
      'blocked'::text
    ])
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.work_assignments(id) ON DELETE CASCADE,
  performed_by_party_id uuid REFERENCES public.work_parties(id),
  checked_in_at timestamptz,
  completed_at timestamptz,
  work_notes text,
  completed_before_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id)
);

CREATE TABLE IF NOT EXISTS public.work_time_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.work_assignments(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (
    entry_type = ANY (ARRAY['time'::text, 'materials'::text, 'cost'::text])
  ),
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_label text,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  hours numeric(10,2) CHECK (hours IS NULL OR hours > 0),
  notes text,
  recorded_by_party_id uuid REFERENCES public.work_parties(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.work_assignments(id) ON DELETE SET NULL,
  exception_type text NOT NULL CHECK (
    exception_type = ANY (ARRAY[
      'vendor_noshow'::text,
      'scope_addition'::text,
      'problem'::text,
      'other'::text
    ])
  ),
  description text NOT NULL,
  submitted_by_party_id uuid NOT NULL REFERENCES public.work_parties(id),
  approver_party_id uuid REFERENCES public.work_parties(id),
  status text NOT NULL DEFAULT 'pending_approval' CHECK (
    status = ANY (ARRAY[
      'submitted'::text,
      'pending_approval'::text,
      'approved'::text,
      'rejected'::text
    ])
  ),
  -- Billing handoff flag: only true after manager approval (no invoice writes here)
  billable_eligible boolean NOT NULL DEFAULT false,
  estimated_amount numeric(14,2) CHECK (estimated_amount IS NULL OR estimated_amount >= 0),
  resolution_notes text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES public.work_assignments(id) ON DELETE CASCADE,
  exception_id uuid REFERENCES public.work_exceptions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text,
  external_url text,
  content_type text,
  uploaded_by_party_id uuid REFERENCES public.work_parties(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (assignment_id IS NOT NULL OR exception_id IS NOT NULL),
  CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS work_assignments_contract_idx
  ON public.work_assignments (contract_id);
CREATE INDEX IF NOT EXISTS work_assignments_assignee_idx
  ON public.work_assignments (assignee_party_id);
CREATE INDEX IF NOT EXISTS work_assignments_deliverable_idx
  ON public.work_assignments (deliverable_id);
CREATE INDEX IF NOT EXISTS contract_deliverables_contract_idx
  ON public.contract_deliverables (contract_id);
CREATE INDEX IF NOT EXISTS work_exceptions_contract_idx
  ON public.work_exceptions (contract_id);
CREATE INDEX IF NOT EXISTS work_exceptions_status_idx
  ON public.work_exceptions (status);

ALTER TABLE public.work_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_time_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_parties_demo_all ON public.work_parties;
CREATE POLICY work_parties_demo_all ON public.work_parties
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS contract_deliverables_demo_all ON public.contract_deliverables;
CREATE POLICY contract_deliverables_demo_all ON public.contract_deliverables
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_assignments_demo_all ON public.work_assignments;
CREATE POLICY work_assignments_demo_all ON public.work_assignments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_completions_demo_all ON public.work_completions;
CREATE POLICY work_completions_demo_all ON public.work_completions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_time_materials_demo_all ON public.work_time_materials;
CREATE POLICY work_time_materials_demo_all ON public.work_time_materials
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_exceptions_demo_all ON public.work_exceptions;
CREATE POLICY work_exceptions_demo_all ON public.work_exceptions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_attachments_demo_all ON public.work_attachments;
CREATE POLICY work_attachments_demo_all ON public.work_attachments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Event risk board helper: promised / scheduled / completed counts + event window
CREATE OR REPLACE VIEW public.v_work_event_status AS
SELECT
  c.id AS contract_id,
  c.customer_id,
  c.event_name,
  c.status AS contract_status,
  c.performance_complete,
  cust.name AS customer_name,
  COALESCE(d.promised_count, 0)::integer AS promised_count,
  COALESCE(d.scheduled_count, 0)::integer AS scheduled_count,
  COALESCE(d.completed_count, 0)::integer AS completed_count,
  COALESCE(d.outstanding_count, 0)::integer AS outstanding_count,
  COALESCE(a.assignment_total, 0)::integer AS assignment_total,
  COALESCE(a.assignment_completed, 0)::integer AS assignment_completed,
  COALESCE(e.pending_exceptions, 0)::integer AS pending_exceptions,
  d.event_start,
  d.event_end,
  CASE
    WHEN COALESCE(d.promised_count, 0) = 0 THEN 0
    ELSE round(
      100.0 * COALESCE(d.outstanding_count, 0)::numeric
        / NULLIF(d.promised_count, 0),
      0
    )
  END AS outstanding_pct
FROM public.contracts c
JOIN public.customers cust ON cust.id = c.customer_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS promised_count,
    count(*) FILTER (
      WHERE cd.status IN ('scheduled', 'in_progress', 'completed')
    )::integer AS scheduled_count,
    count(*) FILTER (WHERE cd.status = 'completed')::integer AS completed_count,
    count(*) FILTER (
      WHERE cd.status NOT IN ('completed', 'waived')
    )::integer AS outstanding_count,
    min(cd.scheduled_start) AS event_start,
    max(cd.scheduled_end) AS event_end
  FROM public.contract_deliverables cd
  WHERE cd.contract_id = c.id
) d ON true
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS assignment_total,
    count(*) FILTER (WHERE wa.status = 'completed')::integer AS assignment_completed
  FROM public.work_assignments wa
  WHERE wa.contract_id = c.id
) a ON true
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS pending_exceptions
  FROM public.work_exceptions we
  WHERE we.contract_id = c.id
    AND we.status IN ('submitted', 'pending_approval')
) e ON true;
