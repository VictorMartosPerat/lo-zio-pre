-- Drop over-permissive policies on orders/order_items that survived the
-- 2026-05-09 reassert migration because they had different names than the
-- ones that migration explicitly dropped.
--
-- Policies removed:
--   • "Anyone can read orders by id"        (orders, SELECT, USING (true))
--       → anyone, including unauthenticated, could read any order.
--   • "Anyone can read order items"          (order_items, SELECT, USING (true))
--       → same, for line items.
--   • "Anyone can update order payment status" (orders, UPDATE, USING+CHECK true)
--       → CRITICAL: anyone could mark any order as paid without paying.
--   • "Anyone can insert order items"        (order_items, INSERT, CHECK (true))
--       → anyone could inject items into anyone's order.
--   • "Anyone can create orders"             (orders, INSERT) — duplicate of
--       the safer "Anyone can create orders with safe defaults" policy.
--
-- After this migration, the visibility model on orders/order_items is:
--   • anon            → NO read access (guests see their order only via the
--                        client-side router state immediately after creation,
--                        or via the confirm-stripe-payment Edge Function after
--                        a Stripe redirect, never via direct REST).
--   • authenticated   → read only own (auth.uid() = user_id).
--   • pizzeria staff  → read assigned orders (assigned_to matches role).
--   • admin           → read all.
--
-- The client-side UPDATE that previously marked orders as paid has been
-- replaced by the confirm-stripe-payment Edge Function, which verifies with
-- Stripe and uses the service role to write.

DROP POLICY IF EXISTS "Anyone can read orders by id"          ON public.orders;
DROP POLICY IF EXISTS "Anyone can update order payment status" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders"               ON public.orders;

DROP POLICY IF EXISTS "Anyone can read order items"            ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert order items"          ON public.order_items;
