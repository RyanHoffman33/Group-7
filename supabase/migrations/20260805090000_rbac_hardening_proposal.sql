-- PROPOSAL ONLY — do not apply to shared ACCY628 Supabase until the team agrees.
-- Branch: Users-and-Roles/Brandon
-- Purpose: Replace open demo RLS with role-aware policies once Supabase Auth + profiles exist.
--
-- Prerequisite: profiles.role_key populated from auth.uid(); app stops using anon-only
-- server client for user-facing queries (or uses service role exclusively server-side).

-- Example helper (requires profiles table from proposed-users-roles-schema.md):
-- create or replace function public.current_app_role()
-- returns text
-- language sql
-- stable
-- as $$
--   select role_key from public.profiles where id = auth.uid()
-- $$;

-- Example: block Event Coordinators from AR tables
-- drop policy if exists invoices_demo_all on public.invoices;
-- create policy invoices_select_by_role on public.invoices
-- for select to authenticated
-- using (
--   public.current_app_role() in ('executive','accounting','department_manager','project_manager')
-- );

-- Example: customers see only own customer_id
-- create policy invoices_customer_own on public.invoices
-- for select to authenticated
-- using (
--   public.current_app_role() = 'customer'
--   and customer_id = (select customer_id from public.profiles where id = auth.uid())
-- );

-- Example: prevent role self-elevation
-- create policy profiles_no_self_role_update on public.profiles
-- for update to authenticated
-- using (id = auth.uid())
-- with check (
--   role_key is not distinct from (select role_key from public.profiles p where p.id = auth.uid())
-- );

-- Until Auth lands, Next.js middleware + server actions enforce RBAC in-app.
select 1;
