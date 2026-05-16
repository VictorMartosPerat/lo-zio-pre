CREATE POLICY "Admins can insert reservations"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));