-- Drop the AFTER INSERT trigger that reserved the redemption immediately
DROP TRIGGER IF EXISTS orders_reserve_discount_redemption ON public.orders;

-- Recreate the function to fire on status transition (pending -> confirmed-like)
CREATE OR REPLACE FUNCTION public.reserve_discount_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.discount_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only on confirmation transition: pending -> confirmed/preparing/ready/delivered/completed
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'pending'
     AND NEW.status IN ('confirmed','preparing','ready','delivered','completed')
     AND OLD.status IS DISTINCT FROM NEW.status THEN

    INSERT INTO public.discount_redemptions(discount_id, user_id, order_id, discount_amount)
      VALUES (NEW.discount_id, NEW.user_id, NEW.id, NEW.discount_amount)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Attach as AFTER UPDATE OF status
CREATE TRIGGER orders_reserve_discount_redemption
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.reserve_discount_redemption();