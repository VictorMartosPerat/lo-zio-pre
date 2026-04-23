
-- Allow authenticated non-admin users to view active tables (for availability checks)
CREATE POLICY "Authenticated users can view active tables"
ON public.tables FOR SELECT TO authenticated
USING (is_active = true);

-- Allow authenticated users to view all reservations (needed for availability slot calculation)
CREATE POLICY "Authenticated users can view reservations for availability"
ON public.reservations FOR SELECT TO authenticated
USING (true);
