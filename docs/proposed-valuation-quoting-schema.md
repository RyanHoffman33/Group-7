# Proposed valuation & quoting schema

> Documentation only — do **not** apply to the shared Supabase project without team approval.
>
> Current demo stores valuation cases, quotes on `eventRequests`, event-type catalog mutations, and customer create fallbacks in memory (reset on server restart).

## Suggested tables

### `valuation_cases`
- id, created_at, created_by
- contract_id nullable, request_id nullable
- event_name, event_type, guests, current_estimate
- change_summary, recommendation_json

### `event_request_quotes`
- request_id FK, package_id, amount, notes, created_by, returned_at
- status: under_review | quoted | accepted | changes_requested

### `event_types` (catalog)
- value (slug PK), label, created_by, created_at

### Cost flags durable fix
Apply existing migration `supabase/migrations/20260805200000_cost_flags_resolution.sql` so `flags_resolved_*` columns and history action exist. Until then the app uses an in-memory resolution overlay.
