# Proposed Event Operations schema (await team approval)

**Branch:** `Users-and-Roles/Brandon`  
**Status:** Proposal only — **do not apply** to shared Supabase until the team agrees.

The UI currently uses local seed data in [`src/features/events/seed.ts`](../src/features/events/seed.ts).

## Reuse existing tables

| Existing | How event ops connect |
|----------|------------------------|
| `customers` | Via `contracts.customer_id` |
| `contracts` | `events.contract_id` UNIQUE FK — operational wrapper, no duplicated revenue fields |
| Locked GAAP views | Untouched |

## Proposed new tables

| Table | Purpose | Constraints |
|-------|---------|-------------|
| `events` | Operational event | `contract_id` UNIQUE → `contracts(id)` |
| `attendees` | Person records | email unique per org (later) |
| `registrations` | attendee ↔ event | UNIQUE `(event_id, attendee_id)` |
| `qr_codes` | Check-in codes | One **active** QR per `registration_id` |
| `check_ins` | Timestamped check-ins | Duplicate blocked unless override flag |
| `email_campaigns` | Simulated campaigns | status includes `simulated_sent` |
| `email_templates` | Templates | — |
| `email_recipients` | Intended audience rows | FK campaign |
| `speakers` | Speaker roster | public vs private fields |
| `sessions` | Agenda sessions | — |
| `session_speakers` | M:N | UNIQUE `(session_id, speaker_id)` |
| `attendee_sessions` | Personal schedule | UNIQUE `(registration_id, session_id)` |
| `event_announcements` | Attendee notices | event-scoped |
| `event_documents` | Guides / maps / compliance docs | public flag |
| `calendar_items` | Ops calendar (setup, sessions, vendor, email…) | event-scoped |
| `event_tasks` | Coordinator task queue | status includes overdue |
| `event_issues` | On-site blockers | severity + status |
| `speaker_requirements` | Readiness checklist rows | per speaker |
| `room_layouts` | Vendor floor plans | capacity + layout type |
| `room_layout_versions` | Versioned layouts | draft → pending → approved/rejected/locked |
| `room_layout_items` | Placed objects on canvas | type, x/y/w/h |
| `vendor_assignments` | Vendor ↔ event work orders | arrival / load-in |

## Audit fields

`created_at`, `updated_at`, `created_by`, `updated_by` on mutable tables.

## RLS direction

- Attendee: own `registration_id` / `attendee_id` only  
- PM/Coordinator: assigned events  
- Never expose internal costs/P&L to attendee/vendor portals  

## QR payload

`eventId|attendeeId|registrationId` — no PII in the image.
