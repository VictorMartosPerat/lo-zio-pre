-- Fix: revert orders.payment_method constraint to allow 'stripe' (the value
-- the codebase actually uses), not 'card' (which I incorrectly used in
-- migration 20260509000004). Symptom: Stripe checkout fails with
-- 'orders_payment_method_valid' check violation when inserting payment_method='stripe'.
--
-- Note: migration 00004 also had an UPDATE that converted any 'stripe' rows
-- to 'cash'. Those rows can no longer be distinguished from genuine cash
-- orders, so this migration does not attempt to undo the data change.
-- The number of affected rows in production is expected to be small.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_valid;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_valid
    CHECK (payment_method IN ('cash', 'stripe'));
