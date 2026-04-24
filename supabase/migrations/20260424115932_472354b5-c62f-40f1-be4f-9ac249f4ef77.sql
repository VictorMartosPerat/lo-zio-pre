-- Order columns for the assignment / accept-reject workflow
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS estimated_time integer,
  ADD COLUMN IF NOT EXISTS transferred_from text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON public.orders(assigned_to);

-- Backfill assigned_to from pickup_store for legacy data
UPDATE public.orders SET assigned_to = pickup_store WHERE assigned_to IS NULL AND pickup_store IS NOT NULL;

-- Pizzeria staff can view & update their assigned orders
DROP POLICY IF EXISTS "Pizzeria staff can view assigned orders" ON public.orders;
CREATE POLICY "Pizzeria staff can view assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (assigned_to = 'tarragona'   AND public.has_role(auth.uid(), 'pizzeriaTarragona'))
  OR
  (assigned_to = 'arrabassada' AND public.has_role(auth.uid(), 'pizzeriaArrabassada'))
);

DROP POLICY IF EXISTS "Pizzeria staff can update assigned orders" ON public.orders;
CREATE POLICY "Pizzeria staff can update assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  (assigned_to = 'tarragona'   AND public.has_role(auth.uid(), 'pizzeriaTarragona'))
  OR
  (assigned_to = 'arrabassada' AND public.has_role(auth.uid(), 'pizzeriaArrabassada'))
);

-- Pizzeria staff can read items of assigned orders
DROP POLICY IF EXISTS "Pizzeria staff can view assigned order items" ON public.order_items;
CREATE POLICY "Pizzeria staff can view assigned order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        (o.assigned_to = 'tarragona'   AND public.has_role(auth.uid(), 'pizzeriaTarragona'))
        OR
        (o.assigned_to = 'arrabassada' AND public.has_role(auth.uid(), 'pizzeriaArrabassada'))
      )
  )
);

-- Realtime needs full row payloads for the popup UI
ALTER TABLE public.orders REPLICA IDENTITY FULL;