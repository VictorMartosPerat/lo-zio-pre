-- Server-side enum validation for fields that have client-side dropdowns but no
-- database-level constraints. Audit (xss_crit_001) showed category accepts arbitrary
-- values when posted directly to the API, bypassing client controls.

-- reviews.category
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_category_valid
    CHECK (category IN ('food', 'service', 'ambiance', 'value', 'overall'));

-- orders.order_type
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_type_valid
    CHECK (order_type IN ('delivery', 'pickup'));

-- orders.payment_method
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_valid
    CHECK (payment_method IN ('cash', 'card'));

-- orders.status (only admin can update, but enforce valid values)
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_valid
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'));

-- orders.payment_status
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_valid
    CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed'));

-- reservations.status
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_valid
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show'));

-- reservations.location
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_location_valid
    CHECK (location IN ('tarragona', 'arrabassada', 'rincon'));
