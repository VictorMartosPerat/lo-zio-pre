-- Prevent regular users from writing internal_notes on their own profile row.
-- The user UPDATE RLS policy has no column-level restriction, so a user could
-- POST directly to the REST API and overwrite admin notes.
-- Admins (has_role = true) are allowed through; the service role bypasses this trigger.

CREATE OR REPLACE FUNCTION public.prevent_user_internal_notes_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_notes IS DISTINCT FROM OLD.internal_notes
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'internal_notes can only be modified by admins'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_internal_notes ON public.profiles;
CREATE TRIGGER trg_protect_internal_notes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_internal_notes_update();
