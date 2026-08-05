-- ============================================================================
-- Profitability Calculations module — reporting views
-- Branch: Profitability-Calculation/Joseph
-- Status: APPLIED 2026-08-05 as migration "profitability_views" (approved).
--
-- Design rules honored throughout:
--   * New objects only (v_profit_* prefix); no existing table/view touched.
--   * Every view uses WITH (security_invoker = true).
--   * Revenue basis is BILLED-RECOGNIZED — identical to v_profitability_inputs
--     and v_gaap_contract_position.recognized_revenue_billed — so profitability
--     numbers can never disagree with the GAAP compliance pages. Earned-not-
--     billed amounts are shown separately and never mixed into margin.
--   * Collections/aging is the Billing/AR module's domain (ar_bucket_state,
--     billing_alerts, customer_payment_stats). No view here duplicates it.
--   * Cancellation policy (project constitution): forfeited deposits become
--     recognized revenue / a cancellation fee AT the point of cancellation.
--     Canceled contracts are real P&L rows in v_profit_event — never filtered
--     out. In the current schema that recognition is representable only by
--     convention: a cancellation-fee invoice with recognition_status =
--     'recognized' (deposit applied to it), evidenced with evidence_type
--     'other'. deposits.status has no 'forfeited' value and
--     recognition_evidence has no cancellation type — cross-module gap raised
--     separately with the Billing/GAAP owners.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. v_profit_contract_costs — unified cost basis, one row per contract
--
-- Two cost populations exist:
--   (a) cost_entries          — operational actuals ledger (cost tracking module)
--   (b) billable_costs rows that the GAAP module classified in
--       cost_classifications (cost_source = 'billable_costs')
-- Verification on 2026-08-05 showed these are NOT fully disjoint: some
-- cost_entries rows re-record the same economic cost as a classified
-- billable_costs row (e.g. Anderson Wedding floral $4,100 and permits $275,
-- where the cost_entries note itself says "matches GAAP classification").
--
-- DEDUP RULE (approved): the GAAP-classified source wins. A cost_entries
-- actual row is EXCLUDED when it exactly matches a classified billable_costs
-- row on (contract_id, amount, category-equivalent). The category axis is not
-- directly comparable (billable_costs has no category column), so the
-- comparable classification axis is the is_reimbursable flag, which both
-- tables carry. Incurred-date proximity was evaluated and rejected: the
-- confirmed duplicates carry incurred dates ~6 months apart (Jan vs Jul), so
-- a date window would silently fail to dedup real duplicates.
-- Near-matches with differing amounts (e.g. Hotel $2,800 vs $2,400) are NOT
-- auto-deduped — both are counted (conservative) and the pair is surfaced in
-- v_profit_exceptions as suspected_duplicate_cost for human review.
--
-- Category mapping for cost_entries (per gaap_policies "Cost classification"):
--   * is_reimbursable = true            -> reimbursable pass-through (agent/net;
--                                          excluded from margin)
--   * category = 'allocated'            -> overhead (period expense)
--   * category = 'advertising'          -> selling (period expense)
--   * everything else (labor, vendor,
--     equipment, contractor, materials,
--     payroll, travel, ...)             -> direct event COGS
--   Contract-linked payroll/labor is treated as direct labor, not overhead.
-- ----------------------------------------------------------------------------
create view public.v_profit_contract_costs
with (security_invoker = true) as
with dedup_ce as (
    -- cost_entries actuals that duplicate a GAAP-classified billable_costs row:
    -- exact match on contract, amount, and reimbursable classification
    select distinct ce.id
    from cost_entries ce
    join billable_costs bc
      on bc.contract_id = ce.contract_id
     and bc.cost_amount = ce.amount
     and bc.is_reimbursable = ce.is_reimbursable
    join cost_classifications cc on cc.cost_ref_id = bc.id
    where ce.commitment_status = 'actual'
),
ce as (
    select
        e.contract_id,
        sum(e.amount) filter (where e.commitment_status = 'actual'
            and not e.is_reimbursable
            and e.category not in ('allocated', 'advertising'))          as direct_cogs_ce,
        sum(e.amount) filter (where e.commitment_status = 'actual'
            and e.is_reimbursable)                                       as reimbursable_ce,
        sum(e.amount) filter (where e.commitment_status = 'actual'
            and e.category = 'allocated')                                as overhead_ce,
        sum(e.amount) filter (where e.commitment_status = 'actual'
            and e.category = 'advertising')                              as selling_ce,
        sum(e.amount) filter (where e.commitment_status = 'committed')   as committed_open
    from cost_entries e
    where e.id not in (select id from dedup_ce)
    group by e.contract_id
),
cc as (
    select
        contract_id,
        sum(amount) filter (where classification = 'direct_event_cogs')        as direct_cogs_cc,
        sum(amount) filter (where classification = 'reimbursable_passthrough') as reimbursable_cc,
        sum(amount) filter (where classification in ('overhead', 'selling'))   as period_cc
    from cost_classifications
    group by contract_id
)
select
    c.id                                                   as contract_id,
    coalesce(ce.direct_cogs_ce, 0) + coalesce(cc.direct_cogs_cc, 0)   as direct_cogs,
    coalesce(ce.reimbursable_ce, 0) + coalesce(cc.reimbursable_cc, 0) as reimbursable_passthrough,
    coalesce(ce.overhead_ce, 0)                                       as overhead_allocated_entries,
    coalesce(ce.selling_ce, 0) + coalesce(cc.period_cc, 0)            as selling_and_period_expenses,
    coalesce(ce.committed_open, 0)                                    as committed_cost_open,
    coalesce(ce.direct_cogs_ce, 0) + coalesce(ce.reimbursable_ce, 0)
      + coalesce(ce.overhead_ce, 0) + coalesce(ce.selling_ce, 0)      as cost_entries_actual_total,
    coalesce(cc.direct_cogs_cc, 0) + coalesce(cc.reimbursable_cc, 0)
      + coalesce(cc.period_cc, 0)                                     as classified_total
from contracts c
left join ce on ce.contract_id = c.id
left join cc on cc.contract_id = c.id;


-- ----------------------------------------------------------------------------
-- 2. v_profit_event — per-contract (per-event) P&L
--
-- recognized_revenue reuses v_profitability_inputs (billed-recognized basis).
-- earned_not_billed comes from v_contract_asset.contract_asset and is a
-- separately labeled column — it is context, never part of margin.
-- Canceled contracts are INCLUDED deliberately (no status filter): forfeited-
-- deposit / cancellation-fee revenue, if booked as a recognized invoice per
-- policy, flows into recognized_revenue automatically, and costs incurred to
-- date show the resulting margin on the cancellation.
-- ----------------------------------------------------------------------------
create view public.v_profit_event
with (security_invoker = true) as
select
    p.contract_id,
    cp.contract_number,
    p.customer_id,
    cp.customer_name,
    p.event_name,
    cp.event_type,
    cp.event_start,
    cp.event_end,
    cp.status,
    c.canceled_at,
    cp.billing_method,
    cp.project_manager_label,
    cp.current_contract_value                              as contract_value,
    p.recognized_revenue,
    k.direct_cogs,
    p.recognized_revenue - k.direct_cogs                   as gross_margin,
    case when p.recognized_revenue > 0
         then round((p.recognized_revenue - k.direct_cogs)
                    / p.recognized_revenue * 100, 1)
    end                                                    as gross_margin_pct,
    k.reimbursable_passthrough,                            -- memo only; excluded from margin
    k.selling_and_period_expenses,                         -- period expense; not in gross margin
    k.overhead_allocated_entries,                          -- period expense; not in gross margin
    k.committed_cost_open,                                 -- committed, not yet actual
    b.budget_total,
    k.cost_entries_actual_total + k.classified_total       as actual_cost_total,
    coalesce(b.budget_total, 0)
      - (k.cost_entries_actual_total + k.classified_total) as budget_remaining,
    ca.earned_to_date,
    ca.billed_to_date,
    ca.contract_asset                                      as earned_not_billed
from v_profitability_inputs p
join contracts c                       on c.id = p.contract_id
join v_contract_commercial_position cp on cp.contract_id = p.contract_id
join v_profit_contract_costs k         on k.contract_id = p.contract_id
left join v_contract_asset ca          on ca.contract_id = p.contract_id
left join (
    select contract_id, sum(budgeted_amount) as budget_total
    from cost_budgets group by contract_id
) b on b.contract_id = p.contract_id;


-- ----------------------------------------------------------------------------
-- 3. v_profit_customer — customer-level rollup with payment behavior context
-- (payment stats are read from the Billing/AR module's customer_payment_stats;
--  surfaced as context only, not re-derived here)
-- ----------------------------------------------------------------------------
create view public.v_profit_customer
with (security_invoker = true) as
select
    cu.id                                       as customer_id,
    cu.name                                     as customer_name,
    count(e.contract_id)                        as contract_count,
    count(e.contract_id) filter
        (where e.status in ('completed','closed')) as completed_contract_count,
    count(e.contract_id) filter
        (where e.status = 'canceled')           as canceled_contract_count,
    sum(e.contract_value)                       as total_contract_value,
    sum(e.recognized_revenue)                   as recognized_revenue,
    sum(e.direct_cogs)                          as direct_cogs,
    sum(e.gross_margin)                         as gross_margin,
    case when sum(e.recognized_revenue) > 0
         then round(sum(e.gross_margin) / sum(e.recognized_revenue) * 100, 1)
    end                                         as gross_margin_pct,
    sum(e.reimbursable_passthrough)             as reimbursable_passthrough,
    sum(e.earned_not_billed)                    as earned_not_billed,
    ps.avg_days_to_pay,
    ps.on_time_rate
from customers cu
left join v_profit_event e            on e.customer_id = cu.id
left join customer_payment_stats ps   on ps.customer_id = cu.id
group by cu.id, cu.name, ps.avg_days_to_pay, ps.on_time_rate;


-- ----------------------------------------------------------------------------
-- 4. v_profit_event_type — which kinds of events make money
-- ----------------------------------------------------------------------------
create view public.v_profit_event_type
with (security_invoker = true) as
select
    coalesce(e.event_type, 'unspecified')       as event_type,
    count(*)                                    as contract_count,
    round(avg(e.contract_value), 2)             as avg_contract_value,
    sum(e.recognized_revenue)                   as recognized_revenue,
    sum(e.direct_cogs)                          as direct_cogs,
    sum(e.gross_margin)                         as gross_margin,
    case when sum(e.recognized_revenue) > 0
         then round(sum(e.gross_margin) / sum(e.recognized_revenue) * 100, 1)
    end                                         as gross_margin_pct,
    round(avg(e.gross_margin_pct), 1)           as avg_contract_margin_pct,
    sum(e.budget_total)                         as budget_total,
    sum(e.actual_cost_total)                    as actual_cost_total
from v_profit_event e
group by coalesce(e.event_type, 'unspecified');


-- ----------------------------------------------------------------------------
-- 5. v_profit_monthly — monthly P&L on recognition timing
--
-- Revenue month rationale (approved): our recognition policy is point-in-time
-- at the event date; recognition_evidence.evidence_date (e.g. event_completion)
-- implements that directly. So each recognized invoice is dated by the earliest
-- evidence_date linked to it, falling back to invoices.issue_date when no
-- invoice-level evidence row exists. Cancellation-fee revenue, once booked as
-- a recognized invoice, dates the same way (evidence at cancellation, else
-- issue_date).
-- Cost month: cost_entries.incurred_date; classified billable_costs use
-- cost_classifications.period, falling back to billable_costs.incurred_date.
-- ----------------------------------------------------------------------------
create view public.v_profit_monthly
with (security_invoker = true) as
with revenue as (
    select
        date_trunc('month', coalesce(
            (select min(re.evidence_date) from recognition_evidence re
              where re.invoice_id = i.id),
            i.issue_date))::date                as month,
        sum(i.total)                            as recognized_revenue
    from invoices i
    where i.recognition_status = 'recognized'
      and i.status not in ('void', 'canceled', 'draft')
    group by 1
),
dedup_ce as (
    -- same approved dedup rule as v_profit_contract_costs
    select distinct ce.id
    from cost_entries ce
    join billable_costs bc
      on bc.contract_id = ce.contract_id
     and bc.cost_amount = ce.amount
     and bc.is_reimbursable = ce.is_reimbursable
    join cost_classifications cc on cc.cost_ref_id = bc.id
    where ce.commitment_status = 'actual'
),
costs as (
    select date_trunc('month', e.incurred_date)::date as month,
           sum(e.amount) filter (where not e.is_reimbursable
               and e.category not in ('allocated','advertising')) as direct_cogs,
           sum(e.amount) filter (where e.is_reimbursable)         as reimbursable,
           sum(e.amount) filter
               (where e.category in ('allocated','advertising'))  as period_expenses
    from cost_entries e
    where e.commitment_status = 'actual'
      and e.id not in (select id from dedup_ce)
    group by 1
    union all
    select date_trunc('month', coalesce(cc.period, bc.incurred_date))::date,
           sum(cc.amount) filter (where cc.classification = 'direct_event_cogs'),
           sum(cc.amount) filter (where cc.classification = 'reimbursable_passthrough'),
           sum(cc.amount) filter (where cc.classification in ('overhead','selling'))
    from cost_classifications cc
    left join billable_costs bc on bc.id = cc.cost_ref_id
    group by 1
)
select
    coalesce(r.month, c.month)                  as month,
    coalesce(r.recognized_revenue, 0)           as recognized_revenue,
    coalesce(c.direct_cogs, 0)                  as direct_cogs,
    coalesce(r.recognized_revenue, 0)
      - coalesce(c.direct_cogs, 0)              as gross_margin,
    coalesce(c.reimbursable, 0)                 as reimbursable_passthrough,
    coalesce(c.period_expenses, 0)              as period_expenses,
    coalesce(r.recognized_revenue, 0) - coalesce(c.direct_cogs, 0)
      - coalesce(c.period_expenses, 0)          as net_margin
from revenue r
full outer join (
    select month,
           sum(direct_cogs)     as direct_cogs,
           sum(reimbursable)    as reimbursable,
           sum(period_expenses) as period_expenses
    from costs group by month
) c on c.month = r.month
order by 1;


-- ----------------------------------------------------------------------------
-- 6. v_profit_overhead_allocation — informational fully-loaded margin
--
-- Per gaap_policies, overhead is a PERIOD expense and is never part of event
-- gross margin. This view allocates the overhead/selling pool (cost_entries
-- categories 'allocated' + 'advertising', plus any cost_classifications
-- overhead/selling rows) across contracts pro-rata on recognized revenue,
-- purely so management can see a fully-loaded view next to the GAAP one.
-- ----------------------------------------------------------------------------
create view public.v_profit_overhead_allocation
with (security_invoker = true) as
with pool as (
    select (select coalesce(sum(amount), 0) from cost_entries
             where commitment_status = 'actual'
               and category in ('allocated', 'advertising'))
         + (select coalesce(sum(amount), 0) from cost_classifications
             where classification in ('overhead', 'selling')) as overhead_pool
),
base as (
    select e.contract_id, e.event_name, e.recognized_revenue, e.gross_margin,
           sum(e.recognized_revenue) over () as total_recognized
    from v_profit_event e
    where e.recognized_revenue > 0
)
select
    b.contract_id,
    b.event_name,
    b.recognized_revenue,
    b.gross_margin,
    round(p.overhead_pool * b.recognized_revenue / b.total_recognized, 2)
                                               as allocated_overhead,
    b.gross_margin
      - round(p.overhead_pool * b.recognized_revenue / b.total_recognized, 2)
                                               as fully_loaded_margin,
    p.overhead_pool                            as total_overhead_pool
from base b cross join pool p;


-- ----------------------------------------------------------------------------
-- 7. v_profit_exceptions — profitability anomalies needing review
--
-- BOUNDARY NOTE: collections/aging exceptions (overdue invoices, bucket
-- transitions, dunning) are intentionally ABSENT — that is the Billing/AR
-- module's domain (ar_bucket_state, billing_alerts) and is not duplicated here.
--
-- Materiality for missed billing: earned_not_billed exceeding the greater of
-- $500 or 1% of contract value, on contracts already completed/closed.
-- ----------------------------------------------------------------------------
create view public.v_profit_exceptions
with (security_invoker = true) as
-- Missed billing: performance finished but a material balance was never billed
select
    'missed_billing_earned_not_billed'          as exception_type,
    e.contract_id,
    e.event_name,
    null::uuid                                  as ref_id,
    'Contract is ' || e.status || ' with earned-not-billed balance of '
        || e.earned_not_billed                  as detail,
    e.earned_not_billed                         as amount
from v_profit_event e
where e.status in ('completed', 'closed')
  and e.earned_not_billed > greatest(500, e.contract_value * 0.01)
union all
-- Deposit limbo on cancellation: canceled contract still holding a deposit
-- that was neither refunded nor recognized (per locked policy, forfeited
-- deposits must become recognized revenue / a cancellation fee at the point
-- of cancellation). GAAP gap and control finding.
select 'deposit_limbo_on_cancellation', d.contract_id, c.event_name, d.id,
       'Canceled ' || c.canceled_at::date || '; deposit ' || d.amount
           || ' still ' || d.status
           || case when d.status = 'applied'
                    and i.recognition_status is distinct from 'recognized'
                   then ' to an unrecognized invoice' else '' end,
       d.amount
from deposits d
join contracts c on c.id = d.contract_id and c.status = 'canceled'
left join invoices i on i.id = d.applied_to_invoice_id
where d.status = 'unearned'
   or (d.status = 'applied' and i.recognition_status is distinct from 'recognized')
union all
-- Canceled contract with actual costs and no recognized revenue at all:
-- cancellation fee / deposit forfeit was never booked, costs are unrecovered
select 'canceled_with_unrecovered_costs', e.contract_id, e.event_name, null,
       'Canceled with ' || e.actual_cost_total
           || ' actual costs and no recognized revenue'
           || case when c.cancellation_fee_percent > 0
                   then ' (contract carries a ' || c.cancellation_fee_percent
                        || '% cancellation fee that was never invoiced)'
                   else '' end,
       e.actual_cost_total
from v_profit_event e
join contracts c on c.id = e.contract_id
where e.status = 'canceled'
  and e.recognized_revenue = 0
  and e.actual_cost_total > 0
union all
-- Negative margin on contracts with recognized revenue
select 'negative_margin', e.contract_id, e.event_name, null,
       'Gross margin ' || e.gross_margin || ' (' || e.gross_margin_pct || '%)',
       e.gross_margin
from v_profit_event e
where e.recognized_revenue > 0 and e.gross_margin < 0
union all
-- Thin margin (< 10%) on completed/closed contracts
select 'thin_margin', e.contract_id, e.event_name, null,
       'Gross margin only ' || e.gross_margin_pct || '% on ' || e.status || ' contract',
       e.gross_margin
from v_profit_event e
where e.status in ('completed', 'closed')
  and e.recognized_revenue > 0
  and e.gross_margin >= 0
  and e.gross_margin_pct < 10
union all
-- Actual costs exceed total budget
select 'over_budget', e.contract_id, e.event_name, null,
       'Actual ' || e.actual_cost_total || ' vs budget ' || e.budget_total,
       e.actual_cost_total - e.budget_total
from v_profit_event e
where e.budget_total is not null and e.actual_cost_total > e.budget_total
union all
-- Cost-entry data-quality flags raised by the cost tracking module
select 'flagged_cost_entry', ce.contract_id, c.event_name, ce.id,
       concat_ws(', ',
           case when ce.flag_late_entry then 'late entry' end,
           case when ce.flag_duplicate_invoice then 'duplicate invoice' end,
           case when ce.flag_over_committed then 'over committed' end,
           case when ce.flag_after_billing then 'entered after billing' end,
           case when ce.flag_actual_exceeds_committed then 'actual exceeds committed' end),
       ce.amount
from cost_entries ce
join contracts c on c.id = ce.contract_id
where ce.flag_late_entry or ce.flag_duplicate_invoice or ce.flag_over_committed
   or ce.flag_after_billing or ce.flag_actual_exceeds_committed
union all
-- Recognized invoice with no recognition evidence on file
select 'recognized_without_evidence', i.contract_id, c.event_name, i.id,
       'Invoice ' || i.invoice_number || ' recognized but has no evidence row',
       i.total
from invoices i
join contracts c on c.id = i.contract_id
where i.recognition_status = 'recognized'
  and i.status not in ('void', 'canceled', 'draft')
  and not exists (select 1 from recognition_evidence re
                   where re.invoice_id = i.id or (re.invoice_id is null
                     and re.contract_id = i.contract_id))
union all
-- Principal/agent inconsistency: pass-through cost carrying a markup
select 'reimbursable_with_markup', bc.contract_id, c.event_name, bc.id,
       bc.description || ' flagged reimbursable but has markup '
           || bc.markup_percent || '%',
       bc.cost_amount
from billable_costs bc
join contracts c on c.id = bc.contract_id
where bc.is_reimbursable and bc.markup_percent > 0
union all
-- Suspected duplicate across cost sources: same contract, amounts within 20%
-- but not an exact dedup match. Both amounts counted (conservative); shown
-- here for human review.
select 'suspected_duplicate_cost', ce.contract_id, c.event_name, ce.id,
       'cost_entries ' || ce.amount || ' (' || coalesce(ce.vendor_name, ce.category)
           || ') vs classified billable_cost ' || bc.cost_amount
           || ' (' || bc.description || ') — both currently counted',
       ce.amount
from cost_entries ce
join billable_costs bc
  on bc.contract_id = ce.contract_id
 and bc.cost_amount <> ce.amount
 and abs(ce.amount - bc.cost_amount) <= bc.cost_amount * 0.20
join cost_classifications cc on cc.cost_ref_id = bc.id
join contracts c on c.id = ce.contract_id
where ce.commitment_status = 'actual';
