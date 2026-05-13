-- Release discount redemption when order is cancelled
CREATE OR REPLACE FUNCTION public.release_discount_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.discount_id IS NOT NULL THEN
    UPDATE public.discount_redemptions
       SET cancelled_at = now()
     WHERE order_id = NEW.id
       AND cancelled_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_discount_on_cancel ON public.orders;
CREATE TRIGGER trg_release_discount_on_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.release_discount_on_cancel();

-- Backfill: any already-cancelled order with an active redemption
UPDATE public.discount_redemptions r
   SET cancelled_at = now()
  FROM public.orders o
 WHERE r.order_id = o.id
   AND o.status = 'cancelled'
   AND r.cancelled_at IS NULL;