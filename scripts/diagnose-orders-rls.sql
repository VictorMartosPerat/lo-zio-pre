-- Run this in Supabase Studio → SQL Editor to see the live state of
-- INSERT policies on public.orders. The 42501 in incognito means one of:
--   1. No INSERT policy for role 'anon' exists at all.
--   2. The WITH CHECK on the existing policy is unexpectedly failing.

-- A) List every policy on orders (we expect "Anyone can create orders with
-- safe defaults" to be present for INSERT to anon, authenticated).
SELECT policyname, cmd, roles, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'orders'
ORDER BY cmd, policyname;

-- B) Confirm RLS is enabled.
SELECT relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE oid = 'public.orders'::regclass;

-- C) Check the column default for status (must be 'pending' or the safe-
-- defaults policy fails when the client omits status).
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
  AND column_name IN ('status', 'payment_status');
