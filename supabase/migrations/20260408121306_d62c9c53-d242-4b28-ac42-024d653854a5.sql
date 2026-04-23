CREATE POLICY "Users can update own reservations"
ON public.reservations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);