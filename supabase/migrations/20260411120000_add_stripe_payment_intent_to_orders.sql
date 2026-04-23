ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
