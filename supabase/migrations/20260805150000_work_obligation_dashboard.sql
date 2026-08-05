-- Drive Work dashboard from performance obligations (AI or manual), not raw seed deliverables.

CREATE OR REPLACE VIEW public.v_work_event_status AS
SELECT
  c.id AS contract_id,
  c.customer_id,
  c.event_name,
  c.status AS contract_status,
  c.performance_complete,
  cust.name AS customer_name,
  COALESCE(o.promised_count, 0)::integer AS promised_count,
  COALESCE(o.scheduled_count, 0)::integer AS scheduled_count,
  COALESCE(o.completed_count, 0)::integer AS completed_count,
  COALESCE(o.outstanding_count, 0)::integer AS outstanding_count,
  COALESCE(a.assignment_total, 0)::integer AS assignment_total,
  COALESCE(a.assignment_completed, 0)::integer AS assignment_completed,
  COALESCE(e.pending_exceptions, 0)::integer AS pending_exceptions,
  COALESCE(o.event_start, del.event_start) AS event_start,
  COALESCE(o.event_end, del.event_end) AS event_end,
  CASE
    WHEN COALESCE(o.promised_count, 0) = 0 THEN 0
    ELSE round(
      100.0 * COALESCE(o.outstanding_count, 0)::numeric
        / NULLIF(o.promised_count, 0),
      0
    )
  END AS outstanding_pct,
  COALESCE(doc.has_contract, false) AS has_contract,
  COALESCE(o.ai_count, 0)::integer AS ai_obligation_count,
  COALESCE(o.manual_count, 0)::integer AS manual_obligation_count
FROM public.contracts c
JOIN public.customers cust ON cust.id = c.customer_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS promised_count,
    count(*) FILTER (
      WHERE wo.status IN ('scheduled', 'in_progress', 'completed')
    )::integer AS scheduled_count,
    count(*) FILTER (WHERE wo.status = 'completed')::integer AS completed_count,
    count(*) FILTER (
      WHERE wo.status NOT IN ('completed', 'waived')
    )::integer AS outstanding_count,
    count(*) FILTER (WHERE wo.source = 'ai_scan')::integer AS ai_count,
    count(*) FILTER (WHERE wo.source IN ('manual', 'seed'))::integer AS manual_count,
    min(cd.scheduled_start) AS event_start,
    max(cd.scheduled_end) AS event_end
  FROM public.work_performance_obligations wo
  LEFT JOIN public.contract_deliverables cd ON cd.id = wo.deliverable_id
  WHERE wo.contract_id = c.id
) o ON true
LEFT JOIN LATERAL (
  SELECT
    min(cd.scheduled_start) AS event_start,
    max(cd.scheduled_end) AS event_end
  FROM public.contract_deliverables cd
  WHERE cd.contract_id = c.id
) del ON true
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
) e ON true
LEFT JOIN LATERAL (
  SELECT true AS has_contract
  FROM public.work_contract_documents d
  WHERE d.contract_id = c.id
  LIMIT 1
) doc ON true;

-- Backfill: seed/manual obligations from existing deliverables that are not already linked
INSERT INTO public.work_performance_obligations (
  contract_id, deliverable_id, code, title, description, phase, status, source,
  estimated_labor_hours, estimated_supply_cost, ready_for_cost_tracking,
  ready_for_billing_ref, sort_order
)
SELECT
  d.contract_id,
  d.id,
  d.code,
  d.title,
  d.description,
  d.phase,
  CASE d.status
    WHEN 'promised' THEN 'identified'
    WHEN 'scheduled' THEN 'scheduled'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'completed'
    WHEN 'waived' THEN 'waived'
    ELSE 'identified'
  END,
  'seed',
  0,
  0,
  true,
  true,
  d.sort_order
FROM public.contract_deliverables d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.work_performance_obligations o
  WHERE o.contract_id = d.contract_id
    AND o.code = d.code
);
