-- Make endpoint unique so upsert works and we never have duplicates per device
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);

-- Allow users to read & update their own subscriptions (needed for upsert/sync)
CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);