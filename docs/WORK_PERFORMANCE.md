# Work & Performance — handoff notes

## Manual test plan

1. `npm run dev` → open http://localhost:3000/work
2. Confirm risk board shows **Year-End Gala**, **Product Launch Experience**, and **Riverfront Charity Ball** with promised / scheduled / completed / outstanding counts.
3. Open **Riverfront Charity Ball** — note near-event unconfirmed deliverables and risk tone on Live Execution.
4. Open an assignment → **Confirm arrival / start** → **Mark complete** with notes → add time/materials → attach a URL.
5. On Product Launch demo staffing (or similar) → confirm edge-case completion notes; use **Raise exception** for ad hoc scope.
6. **Exception inbox** (`/work/exceptions`) → **Approve (billable)** on a pending item → confirm `billable_eligible` on the resolved list.
7. Reject one exception once to confirm the reject path.

## Merge checklist

- [ ] Migration `supabase/migrations/20260805120000_work_performance.sql` applied on shared Supabase (`eslwjydxevrdgeiqkwtq` — applied during this build).
- [ ] Seed `supabase/seed_work.sql` re-runnable if teammates reset demo data.
- [ ] No invoice creation or GAAP recognition writes from Work actions.
- [ ] AppShell Work accordion works; Work removed from pending team list.
- [ ] FKs only into `contracts` — no column edits on teammate-owned tables.

## Future role split (filter, don’t rebuild)

| Role | What to change |
|------|----------------|
| Crew / vendor | Pass `{ assigneePartyId }` into `listAssignmentsForContract` / filter `listWorkEventStatuses` in [`src/features/work/queries.ts`](../src/features/work/queries.ts) |
| Manager | Gate `approveException` / `rejectException` in [`src/features/work/actions.ts`](../src/features/work/actions.ts) via real `assertCanApproveException`; filter inbox with `{ approverPartyId }` |
| Client | Read-only board filtered by `contracts.customer_id` |
| Auth / RLS | Replace demo-open policies; map session user → `work_parties.id` (or replace stub table with Brandon’s users) |

Demo manager id in seed: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01` (Maya Chen).

## Dependencies on other branches

| Owner | Dependency |
|-------|------------|
| Gabriel (Contracts) | Absorb/replace temporary `contract_deliverables`; optional real `event_date` on contracts |
| Brandon (Users & Roles) | Replace `work_parties` stub; page permissions + RLS |
| Billing | Read `work_exceptions` where `billable_eligible = true` when creating ad hoc / change lines |
| Cost / Walker | Optionally map `work_time_materials` → `billable_*` — Work does **not** write those tables |
| GAAP | Optional later: insert `recognition_evidence` on complete — intentionally deferred in Phase 1 |
