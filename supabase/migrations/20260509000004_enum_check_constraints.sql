-- Server-side enum validation for fields that have client-side dropdowns but no
-- database-level constraints. Audit (xss_crit_001) showed category accepts arbitrary
-- values when posted directly to the API, bypassing client controls.
--
-- The reject_html_input trigger (migration 00002) fires on every UPDATE, including
-- rows that already contain HTML from before the trigger existed. We disable triggers
-- only for the data-normalisation UPDATEs below (enum columns only — no text content
-- is changed), then re-enable before adding the CHECK constraints.

-- ── reviews ──────────────────────────────────────────────────────────────────

ALTER TABLE public.reviews DISABLE TRIGGER trg_reject_html_reviews;

UPDATE public.reviews
  SET category = 'overall'
  WHERE category NOT IN ('food', 'service', 'ambiance', 'value', 'overall');

ALTER TABLE public.reviews ENABLE TRIGGER trg_reject_html_reviews;

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_category_valid;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_category_valid
    CHECK (category IN ('food', 'service', 'ambiance', 'value', 'overall'));

-- ── orders ────────────────────────────────────────────────────────────────────

ALTER TABLE public.orders DISABLE TRIGGER trg_reject_html_orders;

UPDATE public.orders
  SET order_type = 'pickup'
  WHERE order_type NOT IN ('delivery', 'pickup');

UPDATE public.orders
  SET payment_method = 'cash'
  WHERE payment_method NOT IN ('cash', 'card');

UPDATE public.orders
  SET status = 'pending'
  WHERE status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled');

UPDATE public.orders
  SET payment_status = 'pending'
  WHERE payment_status NOT IN ('pending', 'paid', 'refunded', 'failed');

ALTER TABLE public.orders ENABLE TRIGGER trg_reject_html_orders;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_type_valid
    CHECK (order_type IN ('delivery', 'pickup'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_valid
    CHECK (payment_method IN ('cash', 'card'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_valid
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_valid
    CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed'));

-- ── reservations ──────────────────────────────────────────────────────────────

ALTER TABLE public.reservations DISABLE TRIGGER trg_reject_html_reservations;

UPDATE public.reservations
  SET status = 'pending'
  WHERE status NOT IN ('pending', 'confirmed', 'cancelled', 'no_show');

UPDATE public.reservations
  SET location = 'tarragona'
  WHERE location NOT IN ('tarragona', 'arrabassada', 'rincon');

ALTER TABLE public.reservations ENABLE TRIGGER trg_reject_html_reservations;

ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_valid;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_valid
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show'));

ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_location_valid;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_location_valid
    CHECK (location IN ('tarragona', 'arrabassada', 'rincon'));
