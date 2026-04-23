ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_store text CHECK (pickup_store IN ('tarragona', 'arrabassada'));
