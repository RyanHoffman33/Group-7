# Ground rules for this repo (Joseph's working rules)

## Git
- Work ONLY on branch Profitability-Calculation/Joseph. Never check out,
  commit to, or modify any other branch.
- Never push, merge, rebase, or delete branches. The human handles all
  git operations that leave this machine.
- Other branches (origin/GAAP-Compliance, etc.) are READ-ONLY reference:
  git log / git show / git diff only.

## Scope
- I own the Profitability Calculations module only. Do not modify files
  in src/features/billing/, src/app/billing/, src/app/compliance/, or
  any other teammate's module. If a change there seems necessary, stop
  and explain why instead of making it.
- Reuse existing shared components; never restyle or restructure them.

## Supabase (shared live database — highest caution)
- Use ONLY project ACCY628-FINAL-PROJECT (ref eslwjydxevrdgeiqkwtq).
- Never DROP, ALTER, or DELETE against existing tables, views, or data
  created by teammates. New objects only (views/tables for profitability).
- Show me the full SQL and wait for explicit approval before applying
  any migration or write operation. Reads (SELECT) are fine.
- Every migration applied must also be saved as a SQL file in
  supabase/migrations/ so repo and database stay in sync.
