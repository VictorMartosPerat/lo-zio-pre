-- Race condition fix for table assignment (M-02).
--
-- Previously: auto-assign-reservation Edge Function called find_available_tables_multi
-- (read-only) and then INSERTed the reservation in a separate step. Two concurrent
-- callers for the same (location, date, time) could each read the same available
-- table as free and both succeed in inserting → double booking on a single table.
--
-- Fix: combine the lookup + insert under a transactional advisory lock keyed by
-- (location, date). pg_advisory_xact_lock serializes all attempts to reserve at
-- the same store on the same day; the lock releases automatically when the
-- function's implicit transaction commits or rolls back.
--
-- Granularity is intentionally per-(location, date) — not per-(location, date, time)
-- — because multi-table groups (7+ guests) need to evaluate availability across
-- the whole day to choose the best fit, and inter-slot conflicts (90-min overlap)
-- are checked inside find_available_tables_multi.

CREATE OR REPLACE FUNCTION public.atomic_assign_and_reserve(
  _location text,
  _date date,
  _time time,
  _guests integer,
  _guest_name text,
  _phone text,
  _notes text,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _table_ids uuid[];
  _reservation_id uuid;
  _table_names text;
  _final_notes text;
  _lock_key bigint;
BEGIN
  -- hashtextextended produces a stable bigint from the input string.
  -- xact_lock variant auto-releases at transaction end.
  _lock_key := hashtextextended(_location || '|' || _date::text, 0);
  PERFORM pg_advisory_xact_lock(_lock_key);

  SELECT find_available_tables_multi(_location, _date, _time, _guests) INTO _table_ids;

  IF _table_ids IS NULL OR cardinality(_table_ids) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_tables');
  END IF;

  SELECT string_agg(name, ' + ' ORDER BY name) INTO _table_names
    FROM tables WHERE id = ANY(_table_ids);

  IF cardinality(_table_ids) > 1 THEN
    _final_notes := btrim(coalesce(_notes, '') || ' [Grupo ' || _guests || 'p: ' || _table_names || ']');
  ELSE
    _final_notes := _notes;
  END IF;

  INSERT INTO reservations (
    location, guest_name, email, phone, reservation_date, reservation_time,
    guests, notes, user_id, table_id, table_ids, status
  ) VALUES (
    _location, _guest_name, 'online@reserva.lozio', _phone, _date, _time,
    _guests::text, _final_notes, _user_id,
    _table_ids[1], _table_ids, 'confirmed'
  )
  RETURNING id INTO _reservation_id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', _reservation_id,
    'table_ids', to_jsonb(_table_ids),
    'table_names', _table_names
  );
END;
$$;

-- SECURITY DEFINER + service-role-only: only the Edge Function (which uses
-- the service-role key) can invoke this. Direct anon/authenticated callers
-- to PostgREST cannot reach it.
REVOKE EXECUTE ON FUNCTION public.atomic_assign_and_reserve(text, date, time, integer, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_assign_and_reserve(text, date, time, integer, text, text, text, uuid) TO service_role;
