
-- Remove reservations from realtime to prevent PII broadcast
-- Use DO block to handle case where table might not be in publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.reservations;
  END IF;
END $$;
