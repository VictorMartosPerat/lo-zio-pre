-- 1) notify_push_on_order
CREATE OR REPLACE FUNCTION public.notify_push_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_role_key text;
  edge_function_url text;
BEGIN
  IF NEW.assigned_to IS NULL OR NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
  END IF;

  service_role_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1);
  edge_function_url := 'https://lnrnyahzkqqnvlpzrdlv.supabase.co/functions/v1/send-push-notification';

  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', 'orders',
      'schema', 'public',
      'record', row_to_json(NEW)::jsonb
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_push_on_order failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_on_order_insert ON public.orders;
CREATE TRIGGER trg_notify_push_on_order_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_order();

DROP TRIGGER IF EXISTS trg_notify_push_on_order_update ON public.orders;
CREATE TRIGGER trg_notify_push_on_order_update
AFTER UPDATE OF assigned_to, status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_order();

-- 2) repair_orders_insert_policy
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

ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'pending';

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

-- 3) payment_status refunded
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending','paid','failed','refunded'));

-- 4) can_insert_order_item + policy
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
DROP POLICY IF EXISTS "Customers can create items for pending orders" ON public.order_items;

CREATE POLICY "Customers can create items for pending orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (public.can_insert_order_item(order_id));