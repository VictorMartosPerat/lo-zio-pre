
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
  _req_end integer;
  _tables uuid[];
  _total_capacity integer := 0;
  _row record;
BEGIN
  _req_start := EXTRACT(HOUR FROM _time)::integer * 60 + EXTRACT(MINUTE FROM _time)::integer;
  _req_end := _req_start + 90;

  -- If a single table can fit, use the existing best-fit logic
  IF _guests <= 6 THEN
    SELECT ARRAY[t.id] INTO _tables
    FROM tables t
    WHERE t.location = _location
      AND t.is_active = true
      AND t.name IN ('Mesa 1','Mesa 2','Mesa 3','Mesa 4','Mesa 5','Mesa 6','Mesa 7','Mesa 8')
      AND t.capacity >= _guests
      AND NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.table_id = t.id
          AND r.reservation_date = _date
          AND r.status IN ('pending', 'confirmed')
          AND (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer) < _req_end
          AND (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer + 90) > _req_start
      )
    ORDER BY t.capacity ASC, t.name ASC
    LIMIT 1;

    RETURN _tables;
  END IF;

  -- For 7+ guests, find multiple free tables that together have enough capacity
  _tables := ARRAY[]::uuid[];
  FOR _row IN
    SELECT t.id, t.capacity
    FROM tables t
    WHERE t.location = _location
      AND t.is_active = true
      AND t.name IN ('Mesa 1','Mesa 2','Mesa 3','Mesa 4','Mesa 5','Mesa 6','Mesa 7','Mesa 8')
      AND NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.table_id = t.id
          AND r.reservation_date = _date
          AND r.status IN ('pending', 'confirmed')
          AND (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer) < _req_end
          AND (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer + 90) > _req_start
      )
    ORDER BY t.capacity DESC, t.name ASC
  LOOP
    _tables := array_append(_tables, _row.id);
    _total_capacity := _total_capacity + _row.capacity;
    IF _total_capacity >= _guests THEN
      RETURN _tables;
    END IF;
  END LOOP;

  -- Not enough capacity
  RETURN NULL;
END;
$$;
