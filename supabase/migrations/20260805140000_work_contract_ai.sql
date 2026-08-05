-- Work: attached contracts + AI-extracted performance obligations
-- Designed so Billing / Cost / Accounting can read via v_work_obligation_handoff
-- without owning Work tables.

CREATE TABLE IF NOT EXISTS public.work_contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Engagement contract',
  file_name text,
  external_url text,
  storage_path text,
  -- Paste or extracted plain text used by the scan agent
  contract_text text,
  mime_type text,
  scan_status text NOT NULL DEFAULT 'pending' CHECK (
    scan_status = ANY (ARRAY[
      'pending'::text,
      'scanning'::text,
      'scanned'::text,
      'failed'::text
    ])
  ),
  scanned_at timestamptz,
  scan_error text,
  raw_ai_json jsonb,
  uploaded_by_party_id uuid REFERENCES public.work_parties(id),
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contract_text IS NOT NULL OR external_url IS NOT NULL OR storage_path IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.work_performance_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.work_contract_documents(id) ON DELETE SET NULL,
  -- Optional link into operational deliverables used by crew assignments
  deliverable_id uuid REFERENCES public.contract_deliverables(id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  phase text NOT NULL DEFAULT 'planning' CHECK (
    phase = ANY (ARRAY['planning'::text, 'execution'::text, 'wrapup'::text])
  ),
  acceptance_criteria text,
  status text NOT NULL DEFAULT 'identified' CHECK (
    status = ANY (ARRAY[
      'identified'::text,
      'scheduled'::text,
      'in_progress'::text,
      'completed'::text,
      'waived'::text
    ])
  ),
  source text NOT NULL DEFAULT 'ai_scan' CHECK (
    source = ANY (ARRAY['ai_scan'::text, 'manual'::text, 'seed'::text])
  ),
  estimated_labor_hours numeric(10,2) DEFAULT 0 CHECK (estimated_labor_hours >= 0),
  estimated_supply_cost numeric(14,2) DEFAULT 0 CHECK (estimated_supply_cost >= 0),
  -- Handoff flags for other modules (Accounting / Cost / Billing)
  ready_for_cost_tracking boolean NOT NULL DEFAULT true,
  ready_for_billing_ref boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, code)
);

CREATE TABLE IF NOT EXISTS public.work_obligation_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL REFERENCES public.work_performance_obligations(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (
    resource_type = ANY (ARRAY['manpower'::text, 'supply'::text, 'equipment'::text])
  ),
  label text NOT NULL,
  role_or_sku text,
  quantity numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit text,
  estimated_unit_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_unit_cost >= 0),
  notes text,
  -- Cost module can pick these up without rewriting Work tables
  export_to_cost boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_contract_documents_contract_idx
  ON public.work_contract_documents (contract_id);
CREATE INDEX IF NOT EXISTS work_performance_obligations_contract_idx
  ON public.work_performance_obligations (contract_id);
CREATE INDEX IF NOT EXISTS work_obligation_resources_contract_idx
  ON public.work_obligation_resources (contract_id);
CREATE INDEX IF NOT EXISTS work_obligation_resources_obligation_idx
  ON public.work_obligation_resources (obligation_id);
CREATE INDEX IF NOT EXISTS work_obligation_resources_type_idx
  ON public.work_obligation_resources (resource_type);

ALTER TABLE public.work_contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_performance_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_obligation_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_contract_documents_demo_all ON public.work_contract_documents;
CREATE POLICY work_contract_documents_demo_all ON public.work_contract_documents
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_performance_obligations_demo_all ON public.work_performance_obligations;
CREATE POLICY work_performance_obligations_demo_all ON public.work_performance_obligations
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS work_obligation_resources_demo_all ON public.work_obligation_resources;
CREATE POLICY work_obligation_resources_demo_all ON public.work_obligation_resources
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Cross-module handoff view: Cost / Accounting / Billing can SELECT this safely
CREATE OR REPLACE VIEW public.v_work_obligation_handoff AS
SELECT
  o.id AS obligation_id,
  o.contract_id,
  c.event_name,
  c.customer_id,
  cust.name AS customer_name,
  o.code AS obligation_code,
  o.title AS obligation_title,
  o.description,
  o.phase,
  o.status,
  o.source,
  o.estimated_labor_hours,
  o.estimated_supply_cost,
  o.ready_for_cost_tracking,
  o.ready_for_billing_ref,
  o.deliverable_id,
  d.status AS deliverable_status,
  COALESCE(r.manpower_count, 0)::integer AS manpower_line_count,
  COALESCE(r.supply_count, 0)::integer AS supply_line_count,
  COALESCE(r.equipment_count, 0)::integer AS equipment_line_count,
  COALESCE(r.resource_est_total, 0)::numeric AS resource_estimated_total,
  doc.id AS document_id,
  doc.title AS document_title,
  doc.scan_status,
  o.created_at
FROM public.work_performance_obligations o
JOIN public.contracts c ON c.id = o.contract_id
JOIN public.customers cust ON cust.id = c.customer_id
LEFT JOIN public.contract_deliverables d ON d.id = o.deliverable_id
LEFT JOIN public.work_contract_documents doc ON doc.id = o.document_id
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE resource_type = 'manpower') AS manpower_count,
    count(*) FILTER (WHERE resource_type = 'supply') AS supply_count,
    count(*) FILTER (WHERE resource_type = 'equipment') AS equipment_count,
    COALESCE(sum(quantity * estimated_unit_cost), 0) AS resource_est_total
  FROM public.work_obligation_resources wr
  WHERE wr.obligation_id = o.id
) r ON true;

CREATE OR REPLACE VIEW public.v_work_resource_handoff AS
SELECT
  wr.id AS resource_id,
  wr.contract_id,
  wr.obligation_id,
  o.code AS obligation_code,
  o.title AS obligation_title,
  c.event_name,
  c.customer_id,
  wr.resource_type,
  wr.label,
  wr.role_or_sku,
  wr.quantity,
  wr.unit,
  wr.estimated_unit_cost,
  (wr.quantity * wr.estimated_unit_cost)::numeric AS line_estimated_cost,
  wr.export_to_cost,
  wr.notes,
  wr.created_at
FROM public.work_obligation_resources wr
JOIN public.work_performance_obligations o ON o.id = wr.obligation_id
JOIN public.contracts c ON c.id = wr.contract_id
WHERE wr.export_to_cost = true;
