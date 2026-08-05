# MainEvent — main-testing (integrated)

Integration branch that combines teammate feature branches into one runnable Next.js app.

**Branch:** `main-testing`  
**Stack:** Next.js (App Router) + TypeScript + Tailwind + Supabase  
**Default empty trunk:** `main` (intentionally empty)

## Included modules

| Module | Source branch | Routes |
|--------|---------------|--------|
| Billing & A/R | `GAAP-Compliance` / Billing | `/billing/*` |
| GAAP Compliance | `GAAP-Compliance` | `/compliance/*` |
| Contracts & Engagements | `Gabriel-Housey-Contracts` | `/contracts/*` |
| Work & Performance | `Work-and-Performance-Tracking` | `/work/*` |
| Cost & Resources | `Cost&ResourceTracking/Walker` | `/costs/*` |
| Profitability | `Profitability-Calculation/Joseph` | `/profitability/*` |
| Role dashboards | `Dashboard-Role-Specific-Info` | `/dashboard/*` |
| Users & Roles + event ops | `Users-and-Roles/Brandon` | `/users/*`, `/events/*`, `/login`, … |

**Not merged:** `Billing-and-Accounts-Receivable` (Billing-only trim already covered by GAAP-Compliance).

## Local setup

```bash
npm install
cp .env.local.example .env.local
# fill Supabase keys; optional GEMINI_API_KEY for Ask MainEvent
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login). Demo password is `demo` (see Users seed accounts on the login page).

Use **admin@gmail.com** or **executive@gmail.com** / **accounting@gmail.com** to see the broadest finance navigation.

## Notes

- Middleware enforces role route allowlists from Brandon’s RBAC.
- Sidebar shows modules the signed-in role is allowed to open.
- Schema SQL from each module lives under `supabase/`; apply migrations on the shared Supabase project as needed.
- Carson Controls is still pending as a full module.
