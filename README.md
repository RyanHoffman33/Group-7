<<<<<<< HEAD
# Contract-to-Cash — Billing & A/R + GAAP Compliance + Work & Performance
=======
# Contract-to-Cash — Users & Roles (+ Billing / Compliance template)

**Branch:** `Users-and-Roles/Brandon`  
**Forked from:** `GAAP-Compliance` (Billing **plus** Compliance UI kept as working template)  
**Owner:** Brandon — Users & Roles  
**Stack:** Next.js (App Router) + TypeScript + Tailwind + Supabase (Auth/RLS later)

## Why this branch exists

Brandon is building **Users & Roles** before every teammate module is ready. This branch copies the Compliance app shell so navigation, Billing, and GAAP pages remain available for reference, while Users & Roles runs on **local seed data** (no dependency on Contracts, Costs, etc.).

See [`docs/proposed-users-roles-schema.md`](docs/proposed-users-roles-schema.md) before creating shared Users tables.  
See [`docs/proposed-event-operations-schema.md`](docs/proposed-event-operations-schema.md) before creating event-ops tables.

## Event operations (seed-backed)

| Route | Purpose |
|-------|---------|
| `/events` | Event list + registration summary |
| `/events/[id]` | Event overview + funnel |
| `/events/[id]/registration` | Registration & attendance analytics |
| `/events/[id]/attendees` | Roster |
| `/events/[id]/qr` | QR manage + check-in (working demo actions) |
| `/events/[id]/emails` | Campaigns + **simulated** send |
| `/events/[id]/speakers` | Speakers (public vs staff fields) |
| `/events/[id]/agenda` | Sessions |
| `/attendee` | Attendee portal (QR pass, agenda, schedule) |

Feature code: [`src/features/events/`](src/features/events/)

## Users & Roles routes

| Route | Purpose |
|-------|---------|
| `/users` | Module overview + directory preview |
| `/users/directory` | User directory (seed) |
| `/users/roles` | Role templates + permission chips |
| `/users/permissions` | Permission catalog by module |
| `/users/assignments` | Role assignment register |
| `/users/audit` | Access audit placeholder |

Feature code: [`src/features/users/`](src/features/users/) — swap [`adapters/directory.ts`](src/features/users/adapters/directory.ts) when Auth lands.

---

# Billing & A/R + GAAP Compliance (template retained)
>>>>>>> origin/Users-and-Roles/Brandon

GAAP-oriented Billing & A/R, ASC 606 Compliance, and Work & Performance Tracking modules for the ACCY 628 Event Production Company project (MainEvent).

<<<<<<< HEAD
**Branch:** `Work-and-Performance-Tracking` (Work UI on top of Billing + Compliance)  
**Compliance base:** `GAAP-Compliance`  
=======
**Upstream branch:** `GAAP-Compliance`  
>>>>>>> origin/Users-and-Roles/Brandon
**Billing-only branch:** `Billing-and-Accounts-Receivable`  
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

<<<<<<< HEAD
3. Open [http://localhost:3000/billing](http://localhost:3000/billing), [http://localhost:3000/compliance](http://localhost:3000/compliance), or [http://localhost:3000/work](http://localhost:3000/work)
=======
3. Open [http://localhost:3000/login](http://localhost:3000/login)

### Demo role logins (Users & Roles)

Password for every account: **`demo`**

| Email | Dashboard |
|-------|-----------|
| `executive@gmail.com` | Executive |
| `manager@gmail.com` | Project Manager |
| `employee@gmail.com` | Event Coordinator |
| `accounting@gmail.com` | Accounting |
| `vendor@gmail.com` | Vendor |
| `customer@gmail.com` | Customer |
| `deptmanager@gmail.com` | Department Manager |
| `attendee@gmail.com` | Attendee portal |
| `admin@gmail.com` | System Admin |

The signed-in account **automatically** loads that role’s dashboard and limited nav (Cvent-style). Billing/Compliance remain available as template modules for roles that need them. Event ops (registration, QR, emails, speakers) are seed-backed until the proposed schema is approved.
>>>>>>> origin/Users-and-Roles/Brandon

Schema + seed are already applied on the shared Supabase project. SQL copies live under `supabase/` for teammates / disaster recovery. Work seed: [`supabase/seed_work.sql`](supabase/seed_work.sql).

## Module map

### Billing & A/R

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

### GAAP Compliance

| Route | Purpose |
|-------|---------|
| `/compliance` | Contract position: assets, liabilities, deferred, open AR, earned-not-billed |
| `/compliance/recognition` | Evidence register + deferred invoices (billed before vs earned then billed) |
| `/compliance/deposits-retainers` | Deposit/retainer liability treatment |
| `/compliance/modifications` | Change-order register + apply treatment |
| `/compliance/costs` | Cost classification + `v_profitability_inputs` |
| `/compliance/audit` | Ledger browser + evidence pack export (JSON/CSV) |
| `/compliance/policies` | ASC-aligned MainEvent policy cards |

### Work & Performance

| Route | Purpose |
|-------|---------|
| `/work` | Event risk board: promised / scheduled / completed / outstanding (clickable filters) |
| `/work/events/[contractId]` | Lifecycle view + contract entry + numbered performance obligations |
| `/work/assignments/[id]` | Check-in, complete, time/materials, attachments, raise exceptions |
| `/work/exceptions` | Approve/reject exceptions (`billable_eligible` for Billing handoff) |

**Contract entry:** AI paste/scan or guided manual questions → `work_performance_obligations` + `work_obligation_resources`.  
**ASC 606 story:** Work tracks distinct POs and satisfaction evidence; exceptions sit at the end of the sequence; revenue recognition stays in GAAP Compliance.

**Cross-module handoff views (for Cost / Accounting / Billing):**
- `v_work_obligation_handoff`
- `v_work_resource_handoff`

Schema: `supabase/migrations/20260805120000_work_performance.sql` through `20260805180000_unify_as_performance_obligations.sql` · seed: `supabase/seed_work.sql`.  
Assignees live in stub `work_parties` (not auth). Approved exceptions set `billable_eligible=true` but do **not** create invoices.

## GAAP behavior

- **Deposits** start as `unearned` (liability) until applied/earned.
- **Invoices** post AR; `recognition_status` is `deferred` until performance is complete, then `recognized`.
- **Recognition evidence required** — `recognizeRevenue` fails unless a `recognition_evidence` row exists for the invoice or contract.
- **Contract asset** = earned (progress / completed milestones / performance complete) − billed (see `v_contract_asset`).
- **Contract liability** = unearned deposits + deferred billed outstanding (`v_contract_liability`).
- **Mods** preserve `prior_contract_value`; historical invoices are never silently rewritten.
- **Payments** apply via `payment_applications` (partials supported).
- **Ledger** (`ar_ledger_entries`) is append-only for audit.
- Controls: unique invoice numbers; no duplicate open milestone invoices; no pay/void conflicts without unapplying.

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
- GAAP tables: `gaap_policies`, `recognition_evidence`, `contract_modifications`, `cost_classifications`
- Views: `v_ar_outstanding`, `v_unearned_deposits`, `v_contract_asset`, `v_contract_liability`, `v_gaap_contract_position`, `v_profitability_inputs`

**Auth:** Demo RLS is open to `anon`/`authenticated`. Replace with role-based policies when Users & Roles ships.

## GAAP integration (locked contracts)

Do **not** rename the views below — they are the teammate API.

| Teammate | Ownership | How Compliance integrates |
|----------|-----------|---------------------------|
| **Gabriel** | Real `contracts` + approve mods | Keep `contract_modifications.contract_id`. Adapter: [`src/features/gaap/adapters/contracts.ts`](src/features/gaap/adapters/contracts.ts) |
| **Walker** | Real expenses replace `billable_costs` | Classifications stay on `cost_ref_id` + `cost_source`. Adapter: [`src/features/gaap/adapters/costs.ts`](src/features/gaap/adapters/costs.ts) |
| **Jacob** | Work completion | May insert `recognition_evidence` (`event_completion` / `time_sheet`) |
| **Joseph** | Profitability | Consume **only** `v_profitability_inputs` and `v_gaap_contract_position` — no duplicate revenue math |
| **Grayson** | Executive KPIs | Same views for dashboards |
| **Carson** | Controls | Gate `recognizeRevenue` / mod apply behind approval; stubs `assertCanRecognizeRevenue` / `assertCanApplyModification` in [`src/features/gaap/actions.ts`](src/features/gaap/actions.ts) leave `approved_by` / policy hooks ready |
| **Brandon** | Users & Roles | Replace demo open RLS with role policies; **do not change view names** |

Billing upstream stubs remain in [`src/features/billing/adapters/upstream.ts`](src/features/billing/adapters/upstream.ts).

## MainEvent assistant (optional)

The floating **Ask MainEvent** button opens a chat that answers from a **live** Billing + Compliance snapshot (A/R, deposits, contract assets/liabilities, policies).

1. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey) (or [Groq](https://console.groq.com/keys)).
2. Add to `.env.local`:

```bash
GEMINI_API_KEY=your-key
```

3. Restart `npm run dev`. Without a key, the assistant still answers common questions from the snapshot (no LLM).

API: `POST /api/assistant` with `{ "message": "..." }`.

## Deploy (later, after merge to main)

Deploy the repo root to Vercel. Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BILLING_CRON_SECRET`
