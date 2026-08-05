-- Promote orphan operational deliverables into numbered performance obligations
-- so Work tracks one ASC 606-aligned list (no peer "work item" type).

WITH orphans AS (
  SELECT
    d.*,
    COALESCE(
      (
        SELECT max(o.obligation_number)
        FROM public.work_performance_obligations o
        WHERE o.contract_id = d.contract_id
      ),
      0
    ) AS base_num,
    row_number() OVER (
      PARTITION BY d.contract_id
      ORDER BY
        CASE d.phase
          WHEN 'planning' THEN 1
          WHEN 'execution' THEN 2
          WHEN 'wrapup' THEN 3
          ELSE 4
        END,
        d.sort_order,
        d.created_at
    ) AS rn
  FROM public.contract_deliverables d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.work_performance_obligations o
    WHERE o.deliverable_id = d.id
  )
),
ins AS (
  INSERT INTO public.work_performance_obligations (
    contract_id,
    deliverable_id,
    obligation_number,
    code,
    title,
    description,
    phase,
    status,
    source,
    assignee_party_id,
    customer_contact_name,
    customer_contact_email,
    estimated_labor_hours,
    estimated_supply_cost,
    ready_for_cost_tracking,
    ready_for_billing_ref,
    sort_order
  )
  SELECT
    o.contract_id,
    o.id,
    o.base_num + o.rn,
    'PO-' || (o.base_num + o.rn),
    o.title,
    o.description,
    o.phase,
    CASE o.status
      WHEN 'promised' THEN 'identified'
      WHEN 'scheduled' THEN 'scheduled'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'completed' THEN 'completed'
      WHEN 'waived' THEN 'waived'
      ELSE 'identified'
    END,
    'seed',
    (
      SELECT p.id
      FROM public.work_parties p
      WHERE p.active = true
        AND p.party_type IN ('crew', 'vendor')
      ORDER BY p.display_name
      LIMIT 1
    ),
    cust.name || ' AP',
    cust.billing_email,
    0,
    0,
    true,
    true,
    o.base_num + o.rn
  FROM orphans o
  JOIN public.contracts c ON c.id = o.contract_id
  JOIN public.customers cust ON cust.id = c.customer_id
  RETURNING id, contract_id
)
INSERT INTO public.work_obligation_resources (
  obligation_id, contract_id, resource_type, label, quantity, unit,
  estimated_unit_cost, export_to_cost
)
SELECT
  ins.id,
  ins.contract_id,
  'manpower',
  'Assigned crew',
  1,
  'people',
  45,
  true
FROM ins
WHERE NOT EXISTS (
  SELECT 1 FROM public.work_obligation_resources r WHERE r.obligation_id = ins.id
);
