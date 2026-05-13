CREATE OR REPLACE FUNCTION public.validate_discount_preview(p_code citext, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _bucket timestamptz := date_trunc('minute', now());
  _attempts int;
  _d public.discounts%ROWTYPE;
  _used_count int;
  _amount numeric;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_logged_in');
  END IF;

  SELECT attempts INTO _attempts
    FROM public.discount_validation_attempts
   WHERE user_id = _uid AND attempt_minute = _bucket;
  IF _attempts IS NOT NULL AND _attempts >= 10 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'rate_limited');
  END IF;

  SELECT * INTO _d FROM public.discounts WHERE code = p_code;

  IF NOT FOUND THEN
    INSERT INTO public.discount_validation_attempts(user_id, attempt_minute, attempts)
      VALUES (_uid, _bucket, 1)
    ON CONFLICT (user_id, attempt_minute)
      DO UPDATE SET attempts = discount_validation_attempts.attempts + 1;
    RETURN jsonb_build_object('valid', false, 'reason', 'unknown_code');
  END IF;

  IF NOT _d.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;
  IF _d.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  IF _d.min_order_amount IS NOT NULL AND p_subtotal < _d.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'min_order_not_met',
      'min_order_amount', _d.min_order_amount);
  END IF;

  IF EXISTS (SELECT 1 FROM public.discount_assignments WHERE discount_id = _d.id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.discount_assignments
       WHERE discount_id = _d.id AND user_id = _uid
    ) THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'not_assigned');
    END IF;
  END IF;

  -- Already redeemed (confirmed order)?
  IF EXISTS (
    SELECT 1 FROM public.discount_redemptions
     WHERE discount_id = _d.id AND user_id = _uid AND cancelled_at IS NULL
  ) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_used');
  END IF;

  -- Pending order already holding this discount?
  IF EXISTS (
    SELECT 1 FROM public.orders
     WHERE user_id = _uid
       AND discount_id = _d.id
       AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_used');
  END IF;

  IF _d.usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO _used_count
      FROM public.discount_redemptions
     WHERE discount_id = _d.id AND cancelled_at IS NULL;
    IF _used_count >= _d.usage_limit THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'usage_limit_reached');
    END IF;
  END IF;

  _amount := public.compute_discount_amount(_d.discount_type, _d.discount_value, p_subtotal);

  RETURN jsonb_build_object(
    'valid', true,
    'discount_id', _d.id,
    'discount_amount', _amount,
    'code', _d.code::text,
    'name', _d.name,
    'description', _d.description,
    'discount_type', _d.discount_type,
    'discount_value', _d.discount_value
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_discount_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _d public.discounts%ROWTYPE;
  _uid uuid := auth.uid();
  _used int;
BEGIN
  IF NEW.discount_id IS NULL THEN
    NEW.discount_amount := 0;
    RETURN NEW;
  END IF;

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Discounts require authentication' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_id IS NULL OR NEW.user_id <> _uid THEN
    RAISE EXCEPTION 'Discount user mismatch' USING ERRCODE = '42501';
  END IF;
  IF NEW.subtotal_amount IS NULL OR NEW.subtotal_amount <= 0 THEN
    RAISE EXCEPTION 'subtotal_amount required when discount_id is set'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _d FROM public.discounts WHERE id = NEW.discount_id FOR UPDATE;
  IF NOT FOUND OR NOT _d.is_active OR _d.expires_at <= now() THEN
    RAISE EXCEPTION 'Discount is no longer valid' USING ERRCODE = 'check_violation';
  END IF;
  IF _d.min_order_amount IS NOT NULL AND NEW.subtotal_amount < _d.min_order_amount THEN
    RAISE EXCEPTION 'Order subtotal below discount minimum' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.discount_assignments WHERE discount_id = _d.id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.discount_assignments
       WHERE discount_id = _d.id AND user_id = _uid
    ) THEN
      RAISE EXCEPTION 'Discount not assigned to user' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Already redeemed?
  IF EXISTS (
    SELECT 1 FROM public.discount_redemptions
     WHERE discount_id = _d.id AND user_id = _uid AND cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Discount already used' USING ERRCODE = 'check_violation';
  END IF;

  -- Pending order already holding this discount?
  IF EXISTS (
    SELECT 1 FROM public.orders
     WHERE user_id = _uid
       AND discount_id = _d.id
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Discount already attached to a pending order' USING ERRCODE = 'check_violation';
  END IF;

  IF _d.usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO _used
      FROM public.discount_redemptions
     WHERE discount_id = _d.id AND cancelled_at IS NULL;
    IF _used >= _d.usage_limit THEN
      RAISE EXCEPTION 'Discount usage limit reached' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  NEW.discount_amount := public.compute_discount_amount(
    _d.discount_type, _d.discount_value, NEW.subtotal_amount
  );
  NEW.total_amount := NEW.subtotal_amount - NEW.discount_amount;

  RETURN NEW;
END;
$function$;