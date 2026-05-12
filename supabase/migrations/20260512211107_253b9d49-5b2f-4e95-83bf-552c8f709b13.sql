CREATE OR REPLACE FUNCTION public.validate_order_on_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _items_count integer;
  _items_sum numeric;
  _expected_total numeric;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('confirmed', 'preparing', 'ready', 'delivered', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(total_price), 0)
    INTO _items_count, _items_sum
    FROM public.order_items
   WHERE order_id = NEW.id;

  IF _items_count = 0 THEN
    RAISE EXCEPTION 'Cannot confirm order %: it has no items', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- total_amount = sum(items) - discount_amount
  _expected_total := _items_sum - COALESCE(NEW.discount_amount, 0);

  IF ABS(NEW.total_amount - _expected_total) > 0.01 THEN
    RAISE EXCEPTION 'Cannot confirm order %: total_amount (%) does not match items sum (%) minus discount (%)',
      NEW.id, NEW.total_amount, _items_sum, COALESCE(NEW.discount_amount, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;