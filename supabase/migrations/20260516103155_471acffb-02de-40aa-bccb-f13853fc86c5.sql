CREATE OR REPLACE FUNCTION public.enforce_online_tables_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _all_ids uuid[];
  _bad_count int;
BEGIN
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  _all_ids := COALESCE(NEW.table_ids, ARRAY[]::uuid[]);
  IF NEW.table_id IS NOT NULL THEN
    _all_ids := _all_ids || NEW.table_id;
  END IF;

  IF array_length(_all_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _bad_count
  FROM public.tables
  WHERE id = ANY(_all_ids)
    AND name NOT IN ('Mesa 1','Mesa 2','Mesa 3','Mesa 4','Mesa 5','Mesa 6','Mesa 7','Mesa 8');

  IF _bad_count > 0 THEN
    RAISE EXCEPTION 'Solo los administradores pueden reservar en mesas de gestión manual.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_online_tables_only ON public.reservations;
CREATE TRIGGER trg_enforce_online_tables_only
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_online_tables_only();