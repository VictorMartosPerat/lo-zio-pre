-- Repair: ensure the INSERT policy that lets guests (anon) and signed-in
-- users place orders actually exists. Symptom: 42501 "new row violates
-- row-level security policy for table orders" from an incognito tab with
-- no session — meaning auth.uid() is NULL, user_id is NULL, payment_status
-- is 'pending', status defaults to 'pending', stripe_session_id is NULL,
-- yet RLS still denies. Only plausible cause is that "Anyone can create
-- orders with safe defaults" is missing on the remote project (e.g. an
-- earlier migration was skipped).
--
-- This migration drops every prior INSERT policy on orders and recreates
-- the one we want. Safe to re-run.

DROP POLICY IF EXISTS "Anyone can create orders"                   ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders with safe defaults" ON public.orders;

CREATE POLICY "Anyone can create orders with safe defaults"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND payment_status = 'pending'
    AND stripe_session_id IS NULL
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Belt-and-braces: ensure the status column still defaults to 'pending'
-- so guests omitting `status` from the INSERT body pass the WITH CHECK.
ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'pending';

-- order_items: matching INSERT policy. The previous restrict pass also
-- requires the parent order's user_id matches auth.uid() or is null.
DROP POLICY IF EXISTS "Anyone can insert order items"        ON public.order_items;
DROP POLICY IF EXISTS "Users can create items for own orders" ON public.order_items;

CREATE POLICY "Users can create items for own orders"
  ON public.order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );
