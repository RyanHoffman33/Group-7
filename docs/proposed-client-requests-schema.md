# Proposed Client Event Requests Schema

> **Status:** Documentation only. Do **not** apply to the shared Supabase project without team approval.
>
> Current demo implementation stores self-registered users in the in-memory `users` array and event requests in `src/features/requests/seed.ts` (`eventRequests`). Data resets on server restart.

## Tables

### `client_accounts` (or extend existing `profiles` / users)

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| first_name | text not null | |
| last_name | text not null | |
| email | citext unique not null | |
| phone | text not null | |
| password_hash | text not null | Use Supabase Auth preferred; never store plaintext |
| role | text not null default `'customer'` | |
| needs_intake | boolean default true | |
| created_at | timestamptz default now() | |

### `event_requests`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| user_id | uuid FK → auth.users / client_accounts | |
| organization | text not null | |
| event_name | text not null | |
| event_type | text not null | |
| preferred_date | date not null | |
| estimated_guests | int not null check (> 0) | |
| venue_preference | text not null | |
| budget_range | text not null | |
| message_to_team | text not null | |
| status | text not null default `'submitted'` | submitted / under_review / contacted |
| created_at | timestamptz default now() | |
| referral_source | text null | |
| referral_other_text | text null | |
| referral_submitted_at | timestamptz null | |
| referral_skipped | boolean default false | |

## RLS sketch

- Customers: `select/insert/update` own rows where `user_id = auth.uid()`.
- Internal staff: read via role claims; update status only for ops/sales roles.
- Never expose `password_hash` to the client.

## Migration path

1. Keep demo cookie auth until Supabase Auth is wired.
2. Create tables in a feature branch / staging project first.
3. Backfill is unnecessary for demo seed data.
4. Swap `eventRequests` / `users.push` for Supabase client calls behind the same server actions.
