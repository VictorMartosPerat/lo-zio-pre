-- Add table_ids array column so multi-table bookings are stored as a single reservation row
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS table_ids uuid[] DEFAULT NULL;

-- Update find_available_tables_multi to check both table_id AND table_ids array
-- so a table reserved as the secondary table of a group booking is correctly marked as occupied.
CREATE OR REPLACE FUNCTION public.find_available_tables_multi(
  _location text,
  _date date,
  _time time,
  _guests integer
)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req_start integer;
  _req_end   integer;
  _tables    uuid[];
  _total_cap integer := 0;
  _row       record;
BEGIN
  _req_start := EXTRACT(HOUR FROM _time)::integer * 60 + EXTRACT(MINUTE FROM _time)::integer;
  _req_end   := _req_start + 90;

  -- Helper: a table is "occupied" in the window if any reservation references it
  -- via table_id OR via table_ids array, within the 90-min overlap window.

  IF _guests <= 6 THEN
    SELECT ARRAY[t.id] INTO _tables
    FROM tables t
    WHERE t.location  = _location
      AND t.is_active = true
      AND t.name IN ('Mesa 1','Mesa 2','Mesa 3','Mesa 4','Mesa 5','Mesa 6','Mesa 7','Mesa 8')
      AND t.capacity >= _guests
      AND NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE (r.table_id = t.id OR (r.table_ids IS NOT NULL AND t.id = ANY(r.table_ids)))
          AND r.reservation_date = _date
          AND r.status IN ('pending', 'confirmed')
          AND (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer) < _req_end
          AND (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer + 90) > _req_start
      )
    ORDER BY t.capacity ASC, t.name ASC
    LIMIT 1;

    RETURN _tables;
  END IF;

  -- For 7+ guests: pick free tables greedily until combined capacity >= _guests
  _tables := ARRAY[]::uuid[];
  FOR _row IN
    SELECT t.id, t.capacity
    FROM tables t
    WHERE t.location  = _location
      AND t.is_active = true
      AND t.name IN ('Mesa 1','Mesa 2','Mesa 3','Mesa 4','Mesa 5','Mesa 6','Mesa 7','Mesa 8')
      AND NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE (r.table_id = t.id OR (r.table_ids IS NOT NULL AND t.id = ANY(r.table_ids)))
          AND r.reservation_date = _date
          AND r.status IN ('pending', 'confirmed')
          AND (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer) < _req_end
          AND (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer + 90) > _req_start
      )
    ORDER BY t.capacity DESC, t.name ASC
  LOOP
    _tables    := array_append(_tables, _row.id);
    _total_cap := _total_cap + _row.capacity;
    IF _total_cap >= _guests THEN
      RETURN _tables;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;
