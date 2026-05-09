-- Extend reject_html_input trigger to cover profiles.internal_notes.
-- Defense in depth: only admins can write internal_notes (migration 00006),
-- but if an admin account is compromised or makes a mistake, HTML in this
-- column would render as XSS in AdminCustomers.tsx and FloorPlan.tsx where
-- it is shown to other admins.

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
       (NEW.food_preferences IS NOT NULL AND NEW.food_preferences ~* html_pat) OR
       (NEW.internal_notes   IS NOT NULL AND NEW.internal_notes   ~* html_pat) THEN
      RAISE EXCEPTION 'Input contains invalid characters' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
