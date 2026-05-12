-- ============================================================================
-- Discount / coupon system (v1)
-- See implementation plan + R-DISC-001..009.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

CREATE TABLE public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code citext NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed_amount')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  min_order_amount numeric,
  expires_at timestamptz NOT NULL,
  usage_limit int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX discounts_active_expires_idx
  ON public.discounts (is_active, expires_at);

CREATE TABLE public.discount_assignments (
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (discount_id, user_id)
);

CREATE INDEX discount_assignments_user_idx
  ON public.discount_assignments (user_id);

CREATE TABLE public.discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE RESTRICT,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id    uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount numeric NOT NULL CHECK (discount_amount > 0),
  redeemed_at  timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

-- Single-use enforcement (allows re-use after a refund clears cancelled_at)
CREATE UNIQUE INDEX discount_redemptions_one_per_user
  ON public.discount_redemptions(discount_id, user_id)
  WHERE cancelled_at IS NULL;

CREATE INDEX discount_redemptions_discount_idx
  ON public.discount_redemptions (discount_id);

CREATE INDEX discount_redemptions_order_idx
  ON public.discount_redemptions (order_id);

CREATE TABLE public.discount_validation_attempts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_minute timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, attempt_minute)
);

-- ----------------------------------------------------------------------------
-- Orders extension
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN discount_id uuid REFERENCES public.discounts(id) ON DELETE SET NULL,
  ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN subtotal_amount numeric;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_total_matches_subtotal_minus_discount
  CHECK (
    subtotal_amount IS NULL
    OR ABS(total_amount - (subtotal_amount - discount_amount)) < 0.005
  );

-- ----------------------------------------------------------------------------
-- updated_at trigger on discounts
-- ----------------------------------------------------------------------------

CREATE TRIGGER discounts_set_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_validation_attempts ENABLE ROW LEVEL SECURITY;

-- discounts: authenticated users can read currently active+non-expired rows;
-- admins full access.
CREATE POLICY "Authenticated can view active discounts"
  ON public.discounts FOR SELECT
  TO authenticated
  USING (is_active = true AND expires_at > now());

CREATE POLICY "Admins can view all discounts"
  ON public.discounts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert discounts"
  ON public.discounts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update discounts"
  ON public.discounts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete discounts"
  ON public.discounts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- discount_assignments
CREATE POLICY "Users can view their own assignments"
  ON public.discount_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all assignments"
  ON public.discount_assignments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert assignments"
  ON public.discount_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete assignments"
  ON public.discount_assignments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- discount_redemptions
CREATE POLICY "Users can view their own redemptions"
  ON public.discount_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemptions"
  ON public.discount_redemptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies for redemptions: writes happen only via
-- SECURITY DEFINER triggers (apply_discount_to_order) and refund-order
-- (service role).

-- discount_validation_attempts: service role only (no policies = no access for
-- anon/authenticated; SECURITY DEFINER functions bypass RLS).

-- ----------------------------------------------------------------------------
-- Helper: compute discount amount
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_discount_amount(
  _type text, _value numeric, _subtotal numeric
) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _amt numeric;
BEGIN
  IF _type = 'percentage' THEN
    _amt := round((_subtotal * _value / 100.0)::numeric, 2);
  ELSIF _type = 'fixed_amount' THEN
    _amt := _value;
  ELSE
    RAISE EXCEPTION 'Unknown discount_type %', _type;
  END IF;
  -- Clamp at subtotal so total never goes negative.
  IF _amt > _subtotal THEN _amt := _subtotal; END IF;
  IF _amt < 0 THEN _amt := 0; END IF;
  RETURN _amt;
END;
$$;

-- ----------------------------------------------------------------------------
-- validate_discount_preview
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_discount_preview(
  p_code citext, p_subtotal numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bucket timestamptz := date_trunc('minute', now());
  _attempts int;
  _d public.discounts%ROWTYPE;
  _used_count int;
  _redeemed_count int;
  _amount numeric;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_logged_in');
  END IF;

  -- Rate-limit check
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

  -- Restricted discount? Check assignment.
  IF EXISTS (SELECT 1 FROM public.discount_assignments WHERE discount_id = _d.id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.discount_assignments
       WHERE discount_id = _d.id AND user_id = _uid
    ) THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'not_assigned');
    END IF;
  END IF;

  -- Already used?
  IF EXISTS (
    SELECT 1 FROM public.discount_redemptions
     WHERE discount_id = _d.id AND user_id = _uid AND cancelled_at IS NULL
  ) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_used');
  END IF;

  -- Global usage limit?
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
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount_preview(citext, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_discount_preview(citext, numeric) FROM anon, public;

-- ----------------------------------------------------------------------------
-- get_best_assigned_discount
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_best_assigned_discount(p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row record;
  _best_amt numeric := 0;
  _best record;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  FOR _row IN
    SELECT d.*
      FROM public.discounts d
      JOIN public.discount_assignments a ON a.discount_id = d.id
     WHERE a.user_id = _uid
       AND d.is_active = true
       AND d.expires_at > now()
       AND (d.min_order_amount IS NULL OR p_subtotal >= d.min_order_amount)
       AND NOT EXISTS (
         SELECT 1 FROM public.discount_redemptions r
          WHERE r.discount_id = d.id AND r.user_id = _uid AND r.cancelled_at IS NULL
       )
       AND (
         d.usage_limit IS NULL
         OR (SELECT COUNT(*) FROM public.discount_redemptions r2
               WHERE r2.discount_id = d.id AND r2.cancelled_at IS NULL) < d.usage_limit
       )
  LOOP
    DECLARE _amt numeric;
    BEGIN
      _amt := public.compute_discount_amount(_row.discount_type, _row.discount_value, p_subtotal);
      IF _amt > _best_amt THEN
        _best_amt := _amt;
        _best := _row;
      END IF;
    END;
  END LOOP;

  IF _best_amt = 0 THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_id', _best.id,
    'discount_amount', _best_amt,
    'code', _best.code::text,
    'name', _best.name,
    'description', _best.description,
    'discount_type', _best.discount_type,
    'discount_value', _best.discount_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_best_assigned_discount(numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_best_assigned_discount(numeric) FROM anon, public;

-- ----------------------------------------------------------------------------
-- list_my_discounts (for Profile "Mis cupones")
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_my_discounts()
RETURNS TABLE (
  id uuid, code text, name text, description text,
  discount_type text, discount_value numeric,
  min_order_amount numeric, expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT d.id, d.code::text, d.name, d.description,
         d.discount_type, d.discount_value,
         d.min_order_amount, d.expires_at
    FROM public.discounts d
    JOIN public.discount_assignments a ON a.discount_id = d.id
   WHERE a.user_id = _uid
     AND d.is_active = true
     AND d.expires_at > now()
     AND NOT EXISTS (
       SELECT 1 FROM public.discount_redemptions r
        WHERE r.discount_id = d.id AND r.user_id = _uid AND r.cancelled_at IS NULL
     )
   ORDER BY d.expires_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_discounts() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_my_discounts() FROM anon, public;

-- ----------------------------------------------------------------------------
-- BEFORE INSERT trigger: apply discount and recompute server-side
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_discount_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d public.discounts%ROWTYPE;
  _uid uuid := auth.uid();
  _used int;
BEGIN
  IF NEW.discount_id IS NULL THEN
    -- Make sure no one slips a discount_amount through without a discount.
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

  -- Restricted? user must be assigned.
  IF EXISTS (SELECT 1 FROM public.discount_assignments WHERE discount_id = _d.id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.discount_assignments
       WHERE discount_id = _d.id AND user_id = _uid
    ) THEN
      RAISE EXCEPTION 'Discount not assigned to user' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Global usage cap.
  IF _d.usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO _used
      FROM public.discount_redemptions
     WHERE discount_id = _d.id AND cancelled_at IS NULL;
    IF _used >= _d.usage_limit THEN
      RAISE EXCEPTION 'Discount usage limit reached' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Server-authoritative recompute (R-DISC-004).
  NEW.discount_amount := public.compute_discount_amount(
    _d.discount_type, _d.discount_value, NEW.subtotal_amount
  );
  NEW.total_amount := NEW.subtotal_amount - NEW.discount_amount;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_apply_discount
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_discount_to_order();

-- ----------------------------------------------------------------------------
-- AFTER INSERT trigger: reserve the redemption (single-use enforcement)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reserve_discount_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.discount_id IS NULL THEN RETURN NEW; END IF;

  -- Partial unique index discount_redemptions_one_per_user makes this
  -- atomic under concurrency; a duplicate raises 23505 and aborts the
  -- whole order INSERT (transactional).
  INSERT INTO public.discount_redemptions(discount_id, user_id, order_id, discount_amount)
    VALUES (NEW.discount_id, NEW.user_id, NEW.id, NEW.discount_amount);

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_reserve_discount_redemption
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reserve_discount_redemption();
