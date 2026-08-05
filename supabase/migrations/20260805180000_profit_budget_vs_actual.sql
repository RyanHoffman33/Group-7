-- ============================================================================
-- v_profit_budget_vs_actual — per-contract, per-category budget vs actual
-- Branch: Profitability-Calculation/Joseph
-- Status: APPLIED 2026-08-05 as migration "profit_budget_vs_actual" (approved).
--
-- Categories are the shared taxonomy used by both cost_budgets.category and
-- cost_entries.category (labor, vendor, equipment, contractor, materials,
-- travel, payroll, advertising, reimbursable, replacement_parts, allocated,
-- other). A full outer join keeps categories that are budgeted-but-unspent
-- and spent-but-unbudgeted.
--
-- DEDUP RULE: identical to v_profit_contract_costs — a cost_entries actual is
-- excluded when it exactly matches a GAAP-classified billable_costs row on
-- (contract_id, amount, is_reimbursable); the classified source wins. So the
-- excluded amounts must still appear here or the view would not reconcile to
-- v_profit_contract_costs / v_profit_event actual totals: classified
-- billable_costs carry no category, so they surface under the synthetic
-- category 'billable_costs (classified)' with no budget line.
--
-- variance = budgeted - (actual + classified). Positive = under budget.
-- Committed (not yet actual) is shown separately and is NOT in the variance.
-- ============================================================================
create view public.v_profit_budget_vs_actual
with (security_invoker = true) as
with dedup_ce as (
    select distinct ce.id
    from cost_entries ce
    join billable_costs bc
      on bc.contract_id = ce.contract_id
     and bc.cost_amount = ce.amount
     and bc.is_reimbursable = ce.is_reimbursable
    join cost_classifications cc on cc.cost_ref_id = bc.id
    where ce.commitment_status = 'actual'
),
actuals as (
    select e.contract_id, e.category,
           sum(e.amount) filter (where e.commitment_status = 'actual')    as actual_amount,
           sum(e.amount) filter (where e.commitment_status = 'committed') as committed_amount
    from cost_entries e
    where e.id not in (select id from dedup_ce)
    group by e.contract_id, e.category
    union all
    -- GAAP-classified billable_costs: no category of their own; kept visible
    -- under a synthetic category so per-contract totals reconcile
    select cc.contract_id, 'billable_costs (classified)',
           sum(cc.amount), 0
    from cost_classifications cc
    group by cc.contract_id
),
budgets as (
    select b.contract_id, b.category,
           sum(b.budgeted_amount) as budgeted_amount
    from cost_budgets b
    group by b.contract_id, b.category
)
select
    coalesce(b.contract_id, a.contract_id)          as contract_id,
    c.event_name,
    coalesce(b.category, a.category)                as category,
    coalesce(b.budgeted_amount, 0)                  as budgeted_amount,
    coalesce(a.actual_amount, 0)                    as actual_amount,
    coalesce(a.committed_amount, 0)                 as committed_amount,
    coalesce(b.budgeted_amount, 0)
      - coalesce(a.actual_amount, 0)                as variance,
    (coalesce(a.actual_amount, 0)
      > coalesce(b.budgeted_amount, 0))             as over_budget
from budgets b
full outer join actuals a
  on a.contract_id = b.contract_id and a.category = b.category
join contracts c on c.id = coalesce(b.contract_id, a.contract_id);
