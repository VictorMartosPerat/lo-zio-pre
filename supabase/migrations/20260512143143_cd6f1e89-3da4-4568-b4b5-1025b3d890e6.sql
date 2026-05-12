-- Fix B: validar consistencia interna de order_items
CREATE OR REPLACE FUNCTION public.validate_order_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'order_items.quantity must be > 0' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.unit_price IS NULL OR NEW.unit_price < 0 THEN
    RAISE EXCEPTION 'order_items.unit_price must be >= 0' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.total_price IS NULL OR NEW.total_price < 0 THEN
    RAISE EXCEPTION 'order_items.total_price must be >= 0' USING ERRCODE = 'check_violation';
  END IF;
  -- total_price debe ser >= unit_price * quantity (puede incluir extras),
  -- pero nunca menos. Tolerancia 0.01€ para redondeos.
  IF NEW.total_price + 0.01 < (NEW.unit_price * NEW.quantity) THEN
    RAISE EXCEPTION 'order_items.total_price (%) is less than unit_price*quantity (%)',
      NEW.total_price, (NEW.unit_price * NEW.quantity)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_item_pricing_trigger ON public.order_items;
CREATE TRIGGER validate_order_item_pricing_trigger
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_pricing();


-- Fix A: al confirmar (o pasar a preparing/ready/delivered) un pedido,
-- exigir >=1 item y que total_amount coincida con la suma real (±0.01€).
CREATE OR REPLACE FUNCTION public.validate_order_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _items_count integer;
  _items_sum numeric;
BEGIN
  -- Solo aplica al transicionar de 'pending' a un estado avanzado
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

  IF ABS(NEW.total_amount - _items_sum) > 0.01 THEN
    RAISE EXCEPTION 'Cannot confirm order %: total_amount (%) does not match items sum (%)',
      NEW.id, NEW.total_amount, _items_sum
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_on_confirm_trigger ON public.orders;
CREATE TRIGGER validate_order_on_confirm_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_on_confirm();