# Project Brief — Event Production Contract-to-Cash System

## What we're building

A web-based contract-to-cash system for an event-production company. The
company plans and produces events for customers under signed contracts,
managing multiple active engagements at once — from contract signing
through work performed, billing, collections, and profitability analysis.

## Locked accounting decisions (do not deviate without team discussion)

- **Revenue recognition:** point-in-time, recognized on the event date. The
  event is the performance obligation. Deposits and milestone payments
  collected before the event are contract liabilities (unearned revenue),
  not revenue, until the event occurs. Forfeited deposits on cancellation
  become recognized revenue at the point of cancellation.

- **Principal vs. agent:** gross (principal) for vendors we contract with
  directly — catering, AV, staffing. Net/commission (agent) for vendors the
  customer selects and pays directly.

## Required foundations

**1. Users and roles**
Roles must have meaningfully different capabilities, not the same screens
with different labels. Minimum: customer, employee (with sub-roles likely
needed — coordinator/event planner, finance/accounting, manager/executive),
and external vendor. Each role needs its own sign-on and its own view.

**2. Customer contracts and engagements**
Manage multiple active event contracts simultaneously. Each contract
captures: customer, event date, event type, scope/deliverables, total
price, deposit amount and due date, milestone payment schedule, vendor
commitments, cancellation/termination terms, and change-order procedure.
A PDF upload of a contract is not sufficient — terms must be structured
data that drives scheduling, billing, and accounting.

**3. Work and performance tracking**
Track what's been promised, scheduled, and completed for each event:
vendor confirmations, milestones reached, deliverables submitted,
event-day completion. Employees/coordinators and vendors need their own
interface to document their own work directly (not entered after the fact
by a manager) — e.g., confirm arrival, record completion, log time/materials
used, flag additional work needed, request approval for ad hoc charges.

**4. Cost and resource tracking**
Track costs by event/contract: labor, contractor/vendor costs, travel,
materials, equipment, reimbursable expenses. Every cost entry must link to
a specific event so profitability can be calculated per event.

**5. Billing and accounts receivable**
Generate invoices/charges per the contract's billing method (deposit,
milestone, final balance). Track paid, partially paid, unpaid, disputed,
and canceled status. Recording an invoice or receiving payment is not the
same as recognizing revenue — see the locked accounting decisions above.

**6. Accounting and GAAP**
Every money-related feature must reflect proper accrual accounting per the
locked revenue recognition and principal/agent decisions above. Consider:
how deposits/retainers are treated, how contract modifications (change
orders) are handled, whether amounts are billed before or after work is
performed, how canceled contracts and forfeited deposits are recorded.

**7. Profitability calculations**
Calculate profitability per event: revenue recognized minus vendor costs,
labor, and allocated overhead. Roll up by customer, by event type, by
month. Don't stop at total revenue or total invoiced — show whether the
business is actually making money on each engagement.

**8. Dashboards and role-specific information**
Each role gets a workspace showing only what's relevant to their
responsibilities and decisions — not one shared dashboard with filtered
labels. A customer dashboard might show event status, work performed,
and amount billed. A coordinator dashboard might show upcoming
assignments and outstanding vendor confirmations. Not every role needs
charts — a task list or status view may be more useful than a graph.

**9. Controls (operational, fraud, accounting, data integrity)**
Identify specific risks for an event-production business and build
practical controls against them. Frame each as: "This business faces
[risk]. Our app reduces the risk by [control]." Consider: vendor booking
without customer deposit/contract on file, unauthorized change orders,
duplicate vendor billing, work/costs entered without approval, improper
discounts or write-offs on disputed charges.

**10. Seed data**
Load meaningful sample data, not a token few records. Must include edge
cases: unprofitable events, late/over-budget events, unpaid or disputed
invoices, partial payments, canceled contracts with forfeited deposits,
renewed/repeat-customer contracts, change orders approved after work
started, costs entered after billing. Fake data only — no real customer,
contract, or payment information.
