
-- Create the find_available_table function
CREATE OR REPLACE FUNCTION public.find_available_table(
  _location text,
  _date date,
  _time time,
  _guests integer
)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _table_id uuid;
  _req_start integer;
  _req_end integer;
BEGIN
  -- Convert requested time to minutes since midnight
  _req_start := EXTRACT(HOUR FROM _time)::integer * 60 + EXTRACT(MINUTE FROM _time)::integer;
  _req_end := _req_start + 90; -- 90 minute reservation

  -- Find best-fit available table among M1-M8 (Mesa 1 to Mesa 8)
  -- Best fit = smallest capacity that fits the guests, among free tables
  SELECT t.id INTO _table_id
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
        AND (
          (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer) < _req_end
          AND
          (EXTRACT(HOUR FROM r.reservation_time)::integer * 60 + EXTRACT(MINUTE FROM r.reservation_time)::integer + 90) > _req_start
        )
    )
  ORDER BY t.capacity ASC, t.name ASC
  LIMIT 1;

  RETURN _table_id;
END;
$$;
