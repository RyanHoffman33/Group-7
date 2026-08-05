# RBAC permission matrix (Users-and-Roles/Brandon)

Source of truth in code: `src/features/access/matrix.ts` (`ROLE_PERMISSIONS`).

## Permission types

View · Create · Edit · Submit · Approve · Reject · Record · Post · Void · Export · Administer

## Role → key permissions

| Role | Key permissions | Must not |
|------|-----------------|----------|
| Executive | billing/compliance/AR/P&L read, export, major exception approve | Routine invoice/payment entry |
| Project Manager | events.operate, emails/QR manage, expenses.approve ≤ threshold, ready_for_billing, billing.read (event-level) | Record payments, post recognition, issue invoices |
| Event Coordinator | events.assigned_only, qr.checkin, emails.draft, speakers.support, expenses.submit | AR, P&L, recognition, billing module |
| Accounting | billing.write/payment/void, compliance.recognize/modify, costs.classify | Approve own write-offs/refunds |
| Department Manager | approvals.queue, controls.approve, expenses.approve, contracts.approve_co | Create the same txn they approve |
| Vendor | vendor.portal | Other vendors, P&L, AR, customer contracts |
| Customer | customer.portal, contracts.read (own) | Internal costs/margins |
| Attendee | attendee.portal | Contracts, billing, vendors |
| System Admin | users/roles/audit administer, limited portals for support | Default invoice/payment/recognize/approve |

## Data classes

| Class | Examples | Typical roles |
|-------|----------|---------------|
| public | Agenda, venue, announcements | All |
| customer_facing | Own invoices, approvals | Customer + internal finance/PM |
| operational | Tasks, QR, speakers | PM, Coordinator, Vendor (assigned) |
| financial_confidential | AR, P&L, recognition, write-offs | Exec, Accounting, Dept Mgr (+ limited PM) |
| system_restricted | Users, roles, audit config | Admin (+ limited audit readers) |

## Thresholds

See `src/features/access/thresholds.ts` — labeled **configurable demo thresholds**.
