CREATE OR REPLACE FUNCTION public.can_insert_order_item(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = _order_id
      AND o.status = 'pending'
      AND (
        (auth.role() = 'anon' AND o.user_id IS NULL)
        OR (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  );
$$;

DROP POLICY IF EXISTS "Users can create items for own orders" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order_items" ON public.order_items;

CREATE POLICY "Customers can create items for pending orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (public.can_insert_order_item(order_id));