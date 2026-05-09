-- Input sanitization: reject HTML/script injection in user-supplied free-text fields.
-- Confirmed XSS stored in: orders (notes, guest_name, delivery_address, guest_phone),
-- reservations (guest_name, notes, phone), reviews (message), profiles (full_name,
-- address, food_preferences).
-- Strategy: BEFORE INSERT/UPDATE trigger that raises an exception on dangerous patterns.
-- This fires regardless of how the write reaches Postgres (REST API, Edge Function, etc.).

CREATE OR REPLACE FUNCTION public.reject_html_input()
RETURNS TRIGGER AS $$
DECLARE
  -- Matches start of any HTML tag or javascript:/data: URI scheme
  html_pat TEXT := '<[a-zA-Z/!]|javascript:|data:[a-zA-Z]';
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    IF (NEW.guest_name      IS NOT NULL AND NEW.guest_name      ~* html_pat) OR
       (NEW.notes           IS NOT NULL AND NEW.notes           ~* html_pat) OR
       (NEW.delivery_address IS NOT NULL AND NEW.delivery_address ~* html_pat) OR
       (NEW.guest_phone     IS NOT NULL AND NEW.guest_phone     ~* html_pat) THEN
      RAISE EXCEPTION 'Input contains invalid characters' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'reservations' THEN
    IF (NEW.guest_name IS NOT NULL AND NEW.guest_name ~* html_pat) OR
       (NEW.notes      IS NOT NULL AND NEW.notes      ~* html_pat) OR
       (NEW.phone      IS NOT NULL AND NEW.phone      ~* html_pat) THEN
      RAISE EXCEPTION 'Input contains invalid characters' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'reviews' THEN
    IF (NEW.message IS NOT NULL AND NEW.message ~* html_pat) THEN
      RAISE EXCEPTION 'Input contains invalid characters' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    IF (NEW.full_name        IS NOT NULL AND NEW.full_name        ~* html_pat) OR
       (NEW.address          IS NOT NULL AND NEW.address          ~* html_pat) OR
       (NEW.food_preferences IS NOT NULL AND NEW.food_preferences ~* html_pat) THEN
      RAISE EXCEPTION 'Input contains invalid characters' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to each affected table
DROP TRIGGER IF EXISTS trg_reject_html_orders       ON public.orders;
DROP TRIGGER IF EXISTS trg_reject_html_reservations  ON public.reservations;
DROP TRIGGER IF EXISTS trg_reject_html_reviews        ON public.reviews;
DROP TRIGGER IF EXISTS trg_reject_html_profiles       ON public.profiles;

CREATE TRIGGER trg_reject_html_orders
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reject_html_input();

CREATE TRIGGER trg_reject_html_reservations
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.reject_html_input();

CREATE TRIGGER trg_reject_html_reviews
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reject_html_input();

CREATE TRIGGER trg_reject_html_profiles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.reject_html_input();
