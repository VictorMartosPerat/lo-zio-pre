-- Push notifications for new orders
--
-- Mirrors notify_push_on_reservation but for the orders table. Fires when a
-- pending order becomes assigned to a pizzeria — that's the moment kitchen
-- staff need to be alerted, regardless of whether the path was:
--
--   • cash flow      — assigned_to is set on INSERT
--   • Stripe flow    — assigned_to stays NULL on INSERT, then confirm-stripe
--                      -payment sets it on UPDATE once payment succeeds
--   • transfer flow  — staff at one store transfers to the other; assigned_to
--                      changes from storeA → storeB
--
-- Keeping vault-based service-role auth (same pattern as
-- notify_reservation_webhook) so this works whether the function is deployed
-- with verify_jwt = true or false.

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
  -- Only push when there's an assigned store and the order is still pending.
  IF NEW.assigned_to IS NULL OR NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE: skip if neither assigned_to nor the (null→pending) edge changed.
  -- We want to fire on first assignment AND on transfers between stores.
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
