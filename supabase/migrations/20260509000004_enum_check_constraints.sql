-- Server-side enum validation for fields that have client-side dropdowns but no
-- database-level constraints. Audit (xss_crit_001) showed category accepts arbitrary
-- values when posted directly to the API, bypassing client controls.
--
-- Data is normalised to valid values before each constraint is added so that
-- existing rows do not block the migration.

-- reviews.category
UPDATE public.reviews
  SET category = 'overall'
  WHERE category NOT IN ('food', 'service', 'ambiance', 'value', 'overall');

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_category_valid;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_category_valid
    CHECK (category IN ('food', 'service', 'ambiance', 'value', 'overall'));

-- orders.order_type
UPDATE public.orders
  SET order_type = 'pickup'
  WHERE order_type NOT IN ('delivery', 'pickup');

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_type_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_type_valid
    CHECK (order_type IN ('delivery', 'pickup'));

-- orders.payment_method
UPDATE public.orders
  SET payment_method = 'cash'
  WHERE payment_method NOT IN ('cash', 'card');

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_valid
    CHECK (payment_method IN ('cash', 'card'));

-- orders.status
UPDATE public.orders
  SET status = 'pending'
  WHERE status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled');

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_valid
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'));

-- orders.payment_status
UPDATE public.orders
  SET payment_status = 'pending'
  WHERE payment_status NOT IN ('pending', 'paid', 'refunded', 'failed');

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_valid
    CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed'));

-- reservations.status
UPDATE public.reservations
  SET status = 'pending'
  WHERE status NOT IN ('pending', 'confirmed', 'cancelled', 'no_show');

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_status_valid;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_valid
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show'));

-- reservations.location
UPDATE public.reservations
  SET location = 'tarragona'
  WHERE location NOT IN ('tarragona', 'arrabassada', 'rincon');

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_location_valid;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_location_valid
    CHECK (location IN ('tarragona', 'arrabassada', 'rincon'));
