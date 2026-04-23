
-- 1. Fix reservations: remove overly broad SELECT policy for authenticated users
-- The availability check is done via the find_available_tables_multi RPC (SECURITY DEFINER), 
-- so authenticated users don't need direct SELECT on all reservations.
DROP POLICY IF EXISTS "Authenticated users can view reservations for availability" ON public.reservations;

-- 2. Fix orders INSERT: enforce payment_status='pending', no stripe_session_id, and user_id binding
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders with safe defaults"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  payment_status = 'pending'
  AND stripe_session_id IS NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- 3. Fix order_items INSERT: restrict to owned orders only
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Users can create items for own orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = order_items.order_id
      AND (user_id = auth.uid() OR user_id IS NULL)
      AND status = 'pending'
  )
);
