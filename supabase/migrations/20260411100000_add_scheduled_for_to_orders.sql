ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
