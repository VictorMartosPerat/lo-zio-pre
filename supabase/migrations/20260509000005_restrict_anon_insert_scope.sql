-- Tighten INSERT policies on orders and reservations.
-- A malicious guest could POST directly to the REST API and set status/location
-- to arbitrary values, bypassing the application flow.
-- Note: auto-assign-reservation uses the service role key and bypasses RLS,
-- so restricting these policies does not affect the normal reservation flow.

-- orders: add status = 'pending' (was missing — payment_status was already restricted)
DROP POLICY IF EXISTS "Anyone can create orders with safe defaults" ON public.orders;
CREATE POLICY "Anyone can create orders with safe defaults"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND payment_status = 'pending'
    AND stripe_session_id IS NULL
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- reservations: restrict direct REST API inserts to pending status and valid locations
-- (the Edge Function auto-assign-reservation uses service role and is unaffected)
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
CREATE POLICY "Anyone can create reservations"
  ON public.reservations FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND location IN ('tarragona', 'arrabassada', 'rincon')
  );
