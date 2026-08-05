# RBAC test scenarios (Users-and-Roles/Brandon)

Password for all demo accounts: `demo`

## Direct URL denials

| Actor | URL | Expected |
|-------|-----|----------|
| employee@ (Coordinator) | `/billing` | Redirect `/access-denied` |
| employee@ | `/compliance` | Redirect `/access-denied` |
| vendor@ | `/billing` | Redirect `/access-denied` |
| attendee@ | `/events` | Redirect `/access-denied` |
| customer@ | `/users` | Redirect `/access-denied` |

## Action denials (server)

| Actor | Action | Expected message theme |
|-------|--------|------------------------|
| Coordinator | `createAndIssueInvoice` | Missing billing.write / coordinator financial denial |
| PM | `recordPaymentAndApply` | PM cannot independently collect invoice |
| System Admin | `createAndIssueInvoice` | Admin ≠ accounting authority |
| Accounting (submitter of appr-3) | Approve appr-3 | Self-approval blocked |
| Vendor | Mark own invoice paid | SoD denial |

## Allowed actions

| Actor | Action | Expected |
|-------|--------|----------|
| Accounting | Issue invoice | Allowed + audit |
| Coordinator | QR check-in | Allowed + audit |
| Dept Manager | Approve expense appr-2 | Allowed; locks item |
| Executive | View `/billing`, `/compliance` | Allowed (read) |
| Vendor | `/vendor` layouts | Allowed assigned only |
| Attendee | `/attendee` | Own portal only |

## Role assignment

Roles are admin-assigned in seed (`users.roleKey`). Login does not let users pick a permanent role. Demo “Open →” only signs into a pre-seeded account.

## Honest limitations

1. Shared Supabase still has open demo RLS until team applies Auth + proposed migration.
2. Demo session cookie is not cryptographically signed; pages/actions re-resolve role from seed email.
3. Billing queries via anon key are still possible outside the Next app if the anon key is known — mitigate with RLS when Auth lands.
4. Not every billing action function is individually audited yet; issue/recognize paths and access denials are logged.
