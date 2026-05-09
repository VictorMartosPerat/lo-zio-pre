-- Defensive reassertion of orders RLS.
-- Audit (sqli_crit_001) confirmed any authenticated user could read all orders.
-- Root cause: RLS was enabled but a permissive SELECT policy may have been present
-- in the PRE environment. This migration drops any over-permissive policies and
-- re-creates the correct set.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop any wildcard / public SELECT policies that should not exist
DROP POLICY IF EXISTS "Anyone can view orders"    ON public.orders;
DROP POLICY IF EXISTS "Public can view orders"    ON public.orders;
DROP POLICY IF EXISTS "Anyone can view order_items" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order_items" ON public.order_items;

-- Recreate correct SELECT policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Users can view own orders'
  ) THEN
    CREATE POLICY "Users can view own orders"
      ON public.orders FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Admins can view all orders'
  ) THEN
    CREATE POLICY "Admins can view all orders"
      ON public.orders FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Admins can update orders'
  ) THEN
    CREATE POLICY "Admins can update orders"
      ON public.orders FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- order_items: only accessible via the order owner or admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname = 'Users can view own order items'
  ) THEN
    CREATE POLICY "Users can view own order items"
      ON public.order_items FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.orders
          WHERE orders.id = order_items.order_id
            AND orders.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname = 'Admins can view all order items'
  ) THEN
    CREATE POLICY "Admins can view all order items"
      ON public.order_items FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
