# Proposed Users & Roles schema (await team approval)

**Branch:** `Users-and-Roles/Brandon`  
**Status:** Proposal only — do **not** apply to shared Supabase until the team agrees.

This module currently uses **local seed data** in [`src/features/users/seed.ts`](../src/features/users/seed.ts) via [`src/features/users/adapters/directory.ts`](../src/features/users/adapters/directory.ts) so Brandon can build UI and permission maps without other teammates' tables.

## Suggested tables

| Table | Purpose |
|-------|---------|
| `profiles` | Extends Supabase Auth `auth.users` (name, org, status, **role_key**) |
| `app_roles` | Role templates (`executive`, `accounting`, …) |
| `permissions` | Capability keys (see `src/features/access/matrix.ts`) |
| `role_permissions` | Role ↔ permission map |
| `user_role_assignments` | Who holds which role (admin-assigned; audited) |
| `access_audit_log` | Append-only role/access/financial events |
| `approval_thresholds` | Configurable demo thresholds |
| `approval_items` | Expense / write-off / CO queue |

## Integration rules

- Replace demo open RLS with policies keyed by these roles (see `supabase/migrations/20260805090000_rbac_hardening_proposal.sql`).
- **Do not rename** GAAP views (`v_gaap_contract_position`, `v_profitability_inputs`, etc.).
- `assertCanRecognizeRevenue` / `assertCanApplyModification` now call the permission matrix.
- Keep adapters as the only place that talks to Auth/DB so pages stay stable.
- System Administrators manage users/roles — **not** default invoice/payment/recognize authority.
- Prevent users from updating their own `role_key`.

## Fake data only

Seed emails use `@example-*` domains. Never commit real passwords, customer PII, or live keys.
