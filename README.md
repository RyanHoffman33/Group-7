# Contract-to-Cash — Billing & Accounts Receivable

GAAP-oriented Billing & A/R module for the ACCY 628 Event Production Company project (MainEvent).

**Branch:** `Billing-and-Accounts-Receivable`  
**Related:** ASC 606 Compliance lives on branch `GAAP-Compliance`  
**Stack:** Next.js (App Router) + TypeScript + Tailwind + Supabase  
**Supabase project:** `ACCY628-FINAL-PROJECT` (`eslwjydxevrdgeiqkwtq`)

## Why this is isolated

Other teammates have not shipped their modules yet. This app includes **stub** `customers` and `contracts` tables plus seed data so you can run and demo Billing/A/R alone. Upstream reads go through [`src/features/billing/adapters/upstream.ts`](src/features/billing/adapters/upstream.ts). When real Customer/Contract modules land, swap that adapter only — keep the same `customer_id` / `contract_id` keys.

## Billing determination (required scenarios)

Open **Determine charges** (`/billing/determine`) to see how each method calculates the bill:

Fixed-price · Hourly · Time & materials · Milestone · Progress · Retainer · Deposit · Recurring monthly · Per-service · Placement fee · Reimbursable costs · Cost-plus

Invoice statuses tracked: `draft`, `unpaid`, `partially_paid`, `paid`, `disputed`, `canceled`, `void`.

Recurring retainers and simulated ACH drafts: `/billing/recurring` (no real payment processing).

## Local setup

1. Copy env and fill keys (anon/publishable key from Supabase project settings):

```bash
cp .env.local.example .env.local
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Open [http://localhost:3000/billing](http://localhost:3000/billing)

Schema + seed are already applied on the shared Supabase project. SQL copies live under `supabase/` for teammates / disaster recovery.

## Module map

| Route | Purpose |
|-------|---------|
| `/billing` | A/R dashboard, aging mix, GAAP posture, alerts |
| `/billing/determine` | Charge determination by billing method |
| `/billing/invoices` | List + issue invoices |
| `/billing/invoices/[id]` | Detail, payments, ledger, recognize, void, apply deposit |
| `/billing/payments` | Payment register |
| `/billing/deposits` | Unearned deposit liability register |
| `/billing/recurring` | Retainer / recurring schedules + simulated drafts |
| `/billing/aging` | Aging buckets + P(collect) + expected $ |
| `/billing/alerts` | Bucket-transition inbox + manual aging check |

## GAAP behavior (within Billing)

- **Deposits** start as `unearned` (liability) until applied/earned.
- **Invoices** post AR; `recognition_status` is `deferred` until performance is complete, then `recognized`.
- **Payments** apply via `payment_applications` (partials supported).
- **Ledger** (`ar_ledger_entries`) is append-only for audit.
- Controls: unique invoice numbers; no duplicate open milestone invoices; no pay/void conflicts without unapplying.

For full ASC 606 compliance UI (evidence, contract assets/liabilities, mods, cost classification, audit pack), see branch **`GAAP-Compliance`**.

## Aging alerts

When an open invoice moves buckets (`current` → `1-30` → `31-60` → `61-90` → `90+`), a `billing_alerts` row is created with the outstanding amount.

- **Local:** Billing Alerts → **Run aging check**
- **API:** `POST /api/billing/aging-check` with header `Authorization: Bearer $BILLING_CRON_SECRET`
- **Vercel:** [`vercel.json`](vercel.json) schedules a daily cron. Set `BILLING_CRON_SECRET` in Vercel env. Note: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` if you configure `CRON_SECRET`; either align env names or add a rewrite in the route later.

## Teammate integration contract

**This module requires (later):**

- `customers(id, name, billing_email, payment_terms_days, status, …)`
- `contracts(id, customer_id, event_name, contract_value, deposit_required, deposit_percent, status, performance_complete, approved_at, …)`

**This module provides:**

- `invoices`, `invoice_lines`, `payments`, `payment_applications`, `deposits`
- `ar_ledger_entries`, `ar_bucket_state`, `billing_alerts`, `customer_payment_stats`
- Views: `v_ar_outstanding`, `v_unearned_deposits` (for Profitability / Dashboards)

**Auth:** Demo RLS is open to `anon`/`authenticated`. Replace with role-based policies when Users & Roles ships.

## Deploy (later, after merge to main)

Deploy the repo root to Vercel. Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BILLING_CRON_SECRET`
