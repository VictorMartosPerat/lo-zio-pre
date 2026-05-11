-- Run en SQL Editor. Cada bloque devuelve una tabla. Si alguno falla con
-- error rojo, copia el mensaje completo.

-- ── A. INSERT como anon, SIN returning ───────────────────────────────────
BEGIN;
SET LOCAL ROLE anon;
INSERT INTO public.orders (
  user_id, guest_name, guest_email, guest_phone,
  order_type, pickup_store, assigned_to,
  payment_method, payment_status, total_amount
) VALUES (
  NULL, 'DiagA', 'a@x.test', '+34123456789',
  'pickup', 'tarragona', 'tarragona',
  'cash', 'pending', 10.00
);
-- Si llegamos aquí, INSERT pasó la policy. Devolvemos confirmación visible.
SELECT 'A: insert as anon OK' AS result;
ROLLBACK;

-- ── B. INSERT como anon, CON returning * (lo que hace supabase-js) ───────
BEGIN;
SET LOCAL ROLE anon;
INSERT INTO public.orders (
  user_id, guest_name, guest_email, guest_phone,
  order_type, pickup_store, assigned_to,
  payment_method, payment_status, total_amount
) VALUES (
  NULL, 'DiagB', 'b@x.test', '+34123456789',
  'pickup', 'tarragona', 'tarragona',
  'cash', 'pending', 10.00
)
RETURNING id, status, user_id;
-- Si #A pasa pero esto vuelve vacío o error → falta SELECT policy para anon.
ROLLBACK;
