-- Run this in Supabase Studio → SQL Editor.
-- Pega ENTERO y revisa cada NOTICE / fila devuelta.

-- ── 1. Estado del rol anon: auth.uid() debe ser NULL ─────────────────────
SET LOCAL ROLE anon;
SELECT 'auth.uid() as anon: ' || COALESCE(auth.uid()::text, 'NULL') AS check_uid;

-- ── 2. INSERT mínimo como anon (sin select, sin returning) ───────────────
--    Si esto pasa → la policy de INSERT está OK; el fallo del navegador es
--    en el .select() post-INSERT (RETURNING) por falta de SELECT para anon.
--    Si esto falla → la policy genuinamente rechaza algo.
DO $$
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO public.orders (
    user_id, guest_name, guest_email, guest_phone,
    order_type, pickup_store, assigned_to,
    payment_method, payment_status, total_amount
  ) VALUES (
    NULL, 'Diag Anon', 'diag@anon.test', '+34123456789',
    'pickup', 'tarragona', 'tarragona',
    'cash', 'pending', 10.00
  )
  RETURNING id INTO inserted_id;

  RAISE NOTICE '✅ INSERT como anon OK, id=%', inserted_id;

  -- limpiar para no dejar basura
  DELETE FROM public.orders WHERE id = inserted_id;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '❌ INSERT bloqueado por RLS: %', SQLERRM;
WHEN check_violation THEN
  RAISE NOTICE '❌ CHECK constraint o trigger reject_html: %', SQLERRM;
WHEN OTHERS THEN
  RAISE NOTICE '❌ Otro error: % / código %', SQLERRM, SQLSTATE;
END $$;

RESET ROLE;

-- ── 3. INSERT con RETURNING como anon (lo que hace el navegador) ─────────
--    Igual al anterior pero usando RETURNING — si esto falla y el #2 pasa,
--    el problema es la SELECT permission del rol anon.
SET LOCAL ROLE anon;
DO $$
DECLARE
  r record;
BEGIN
  INSERT INTO public.orders (
    user_id, guest_name, guest_email, guest_phone,
    order_type, pickup_store, assigned_to,
    payment_method, payment_status, total_amount
  ) VALUES (
    NULL, 'Diag Returning', 'diag2@anon.test', '+34123456789',
    'pickup', 'tarragona', 'tarragona',
    'cash', 'pending', 10.00
  )
  RETURNING * INTO r;

  RAISE NOTICE '✅ INSERT + RETURNING * como anon OK, id=%', r.id;
  DELETE FROM public.orders WHERE id = r.id;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '❌ INSERT/RETURNING bloqueado: %', SQLERRM;
WHEN OTHERS THEN
  RAISE NOTICE '❌ Otro error: % / código %', SQLERRM, SQLSTATE;
END $$;

RESET ROLE;

-- ── 4. ¿Hay policies RESTRICTIVE escondidas? ─────────────────────────────
SELECT polname, polpermissive, polroles::regrole[]
FROM pg_policy
WHERE polrelid = 'public.orders'::regclass
  AND polcmd IN ('a', '*');  -- 'a' = INSERT, '*' = ALL

-- ── 5. Triggers BEFORE/AFTER INSERT sobre orders (todo, incluyendo los que
--    se hayan aplicado a mano en Studio fuera de migraciones) ─────────────
SELECT trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'orders'
ORDER BY action_timing, trigger_name;
