# Plan de Remediación de Seguridad

**Proyecto:** Lo Zio (PRE)
**Fecha:** 2026-05-09
**Basado en:** [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)

---

## Matriz de priorización (urgente × importante)

```
                       URGENTE                    NO URGENTE
              ┌──────────────────────────┬─────────────────────────────┐
   IMPORTANTE │ H-01 send-transactional   │ M-02 race condition mesas   │
              │     -email auth           │ M-04 storage bucket público │
              │ H-02 tel: href XSS        │ L-01 push notification verif│
              │ H-03 npm audit (RR-DOM)   │ L-04 internal_notes trigger │
              │ M-01 IDOR user_id          │                             │
              ├──────────────────────────┼─────────────────────────────┤
NO IMPORTANTE │ M-03 error leak notify   │ L-02..L-07 (varios)         │
              │     -order-status        │ I-01 docs desactualizados   │
              │                           │ Recomendaciones generales   │
              └──────────────────────────┴─────────────────────────────┘
```

---

## Quick wins (≤30 min cada uno, no requieren coordinación con Lovable)

| ID | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| QW-1 | Validar `tel:` en `IncomingOrderManager.tsx:316` | `src/components/IncomingOrderManager.tsx` | bajo (~5 min) |
| QW-2 | Sanear error messages en `notify-order-status` | `supabase/functions/notify-order-status/index.ts` | bajo (~5 min) |
| QW-3 | Derivar `user_id` del JWT en `auto-assign-reservation` | `supabase/functions/auto-assign-reservation/index.ts` | bajo (~10 min) |
| QW-4 | Añadir `internal_notes` al trigger HTML sanitization (migration 00007) | nueva SQL migration | bajo (~10 min) |
| QW-5 | Reescribir `dangerouslySetInnerHTML` en ReservationSection con JSX | `src/components/ReservationSection.tsx` | bajo (~5 min) |
| QW-6 | `npm audit fix` y verificar tests | `package.json` / `package-lock.json` | bajo (~15 min) |
| QW-7 | Actualizar `CLAUDE.md` y `SKILLS.md` con nuevas Edge Functions y roles | docs | bajo (~10 min) |

**Total quick wins: ~1 hora de trabajo.**

---

## Sprint 1 — Resolver hallazgos altos y medios urgentes (1–2 días)

### Tarea 1 — H-01 — Restringir `send-transactional-email` a callers legítimos

- **Severidad:** ALTA (vector de phishing)
- **Esfuerzo:** medio (~2–3 horas, incluyendo tests)
- **Archivos:**
  - `supabase/functions/send-transactional-email/index.ts`
  - (opcional) `supabase/functions/_shared/auth.ts` (nuevo helper)
- **Pasos:**
  1. Crear helper `parseJwtClaims(token)` y `checkUserOrStaff(supabase, user)` en `_shared/auth.ts`.
  2. Al inicio de la función, después de parsear el body:
     - Si `claims.role === 'service_role'` → permitir.
     - Else: requerir un usuario válido (`auth.getUser()`).
     - Verificar que `recipientEmail.toLowerCase() === user.email.toLowerCase()` **O** que el usuario tenga rol staff.
     - Si ninguna condición se cumple → 403.
  3. Registrar `console.log` con `claim_role`, `recipient_redacted`, `caller_user_id` para auditoría.
- **Tests manuales:**
  - Llamar con bearer token `<publishable_key>` (anon) → debe devolver 403.
  - Llamar autenticado, recipientEmail = propio email → debe enqueue.
  - Llamar autenticado, recipientEmail = otro → debe devolver 403.
  - Llamar autenticado como admin/pizzeriaTarragona → debe enqueue.
  - Llamar desde `notify-order-status` con service_role JWT → debe enqueue.
- **Dependencias:** ninguna.
- **Nota Lovable:** ninguna acción manual requerida. La función se redespliega automáticamente.

### Tarea 2 — H-02 — Validar `tel:` href en IncomingOrderManager (QW-1)

- **Severidad:** ALTA
- **Esfuerzo:** bajo
- **Archivo:** `src/components/IncomingOrderManager.tsx`
- **Cambio:** línea 316:
  ```diff
  - href={`tel:${current.guest_phone}`}
  + href={/^[+\d\s\-().]{1,20}$/.test(current.guest_phone) ? `tel:${current.guest_phone}` : '#'}
  ```
- **Dependencias:** ninguna.

### Tarea 3 — H-03 — Resolver CVEs npm (QW-6)

- **Severidad:** ALTA
- **Esfuerzo:** bajo a medio (depende de breaking changes)
- **Pasos:**
  1. `npm audit fix` y revisar diff.
  2. Re-ejecutar `npm run lint && npm run test && npm run build`.
  3. Smoke test en navegador (login, hacer pedido, ver admin).
  4. Si quedan vulns altas: `npm audit fix --force` con cuidado.
  5. Verificar específicamente que `react-router-dom` se actualizó (CVE de Open Redirect XSS).
- **Dependencias:** ninguna.
- **Riesgo:** posible breaking change menor en react-router 7. Considerar pinning a 6.x con la versión parcheada.

### Tarea 4 — M-01 — Cerrar IDOR de `user_id` en auto-assign-reservation (QW-3)

- **Severidad:** MEDIA
- **Esfuerzo:** bajo
- **Archivo:** `supabase/functions/auto-assign-reservation/index.ts`
- **Cambio:** línea 99 — usar `verifiedUserId` (derivado del JWT) en vez de `user_id` del body.
- **Tests:** intentar enviar `user_id` distinto al del JWT → la reserva debe guardarse con el `user_id` del JWT (o null si guest).
- **Dependencias:** ninguna.

### Tarea 5 — M-03 — Sanitizar errores en notify-order-status (QW-2)

- **Severidad:** MEDIA
- **Esfuerzo:** bajo
- **Cambio:** reemplazar `JSON.stringify({ error: msg })` por `JSON.stringify({ error: "Notification failed." })` en el catch.

### Resultado esperado tras Sprint 1
- 0 vulnerabilidades altas
- IDOR cerrado
- Audit npm sin highs

---

## Sprint 2 — Hardening estructural (3–5 días)

### Tarea 6 — M-02 — Race condition en asignación de mesas

- **Severidad:** MEDIA (integridad de datos)
- **Esfuerzo:** ALTO (~1–2 días)
- **Estrategia recomendada:** advisory lock dentro de una función PL/pgSQL nueva que combine búsqueda + insert atómicamente.
- **Pasos:**
  1. Crear migración `20260510_atomic_reservation_assign.sql`:
     ```sql
     CREATE OR REPLACE FUNCTION public.atomic_assign_and_reserve(...)
     RETURNS TABLE(reservation_id uuid, table_ids uuid[]) AS $$
     BEGIN
       PERFORM pg_advisory_xact_lock(
         hashtextextended(_location || '|' || _date::text, 0)
       );
       -- Llamar find_available_tables_multi
       -- INSERT en reservations
       -- RETURN
     END;
     $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
     ```
  2. Refactorizar `auto-assign-reservation` Edge Function para llamar la nueva RPC en lugar de `find_available_tables_multi` + INSERT.
  3. Tests: ejecutar 10 reservas concurrentes para el mismo slot → solo una debe completar.
- **Dependencias:** Sprint 1 task 4 (M-01) ya cerrada.
- **Lovable:** ninguna acción especial; usuario corre la migración como con el resto.

### Tarea 7 — Centralizar verificación de JWT en `_shared/auth.ts`

- **Severidad:** organizativa (reduce probabilidad de futuros bugs)
- **Esfuerzo:** medio (~3 horas)
- **Pasos:**
  1. Crear `supabase/functions/_shared/auth.ts` con `requireUser`, `requireAdmin`, `requireServiceRole`, `requireStaff`.
  2. Refactorizar las 4 funciones que ya implementan el patrón (refund-order, confirm-reservation, send-push-notification, send-transactional-email tras Sprint 1) para usar el helper.
  3. No tocar las que correctamente no requieren auth (handle-email-unsubscribe, handle-email-suppression con HMAC).
- **Dependencias:** H-01 implementado en Sprint 1.

### Tarea 8 — L-01 — Verificar y arreglar `notify_push_on_reservation`

- **Severidad:** BAJA (potencial bug funcional)
- **Esfuerzo:** bajo
- **Pasos:**
  1. Revisar logs de la función `send-push-notification` en Supabase Dashboard durante 24h. Buscar 401 errors disparados por el trigger.
  2. Si hay 401s: añadir Authorization header desde Vault al `net.http_post`. Migration:
     ```sql
     CREATE OR REPLACE FUNCTION public.notify_push_on_reservation()
     RETURNS trigger
     LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
     DECLARE
       service_role_key text;
     BEGIN
       SELECT decrypted_secret INTO service_role_key
         FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
       PERFORM net.http_post(
         url := '...',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer ' || service_role_key
         ),
         body := jsonb_build_object('record', row_to_json(NEW)::jsonb),
         timeout_milliseconds := 5000
       );
       RETURN NEW;
     EXCEPTION WHEN OTHERS THEN
       RAISE WARNING 'notify_push_on_reservation failed: %', SQLERRM;
       RETURN NEW;
     END;
     $$;
     ```

### Tarea 9 — L-02 — Constant-time compare en preview-transactional-email

- **Severidad:** BAJA
- **Esfuerzo:** bajo
- **Cambio:** ver SECURITY_AUDIT_REPORT.md L-02 para snippet.

### Tarea 10 — L-04 — Añadir `internal_notes` al trigger de sanitización (QW-4)

- **Severidad:** BAJA
- **Esfuerzo:** bajo
- **Acción:** crear migración `20260510_extend_html_trigger.sql` que extienda `reject_html_input()` para incluir `internal_notes` en `profiles`.

### Tarea 11 — M-04 — Storage bucket: política o documentación

- **Severidad:** MEDIA (depende del uso)
- **Esfuerzo:** bajo (documentar) o alto (refactorizar a privado + signed URLs)
- **Decisión a tomar con el dueño:**
  - **Opción A (rápido):** mantener público, añadir validación MIME en `AdminMedia.tsx` para rechazar tipos peligrosos antes del upload. Documentar políticas de uso.
  - **Opción B (correcto):** hacer bucket privado, generar signed URLs con TTL al servir, ajustar el frontend.

---

## Sprint 3 — Mejoras de proceso y monitoring (variable)

### Tarea 12 — L-03 — Auditar cabeceras HTTP en producción

- Ejecutar `curl -I https://pizzeriaslozio.com/`. Si faltan cabeceras, abrir ticket con Lovable o configurar Cloudflare.

### Tarea 13 — Rate limiting (pendiente del usuario)

- Configurar Auth rate limits en el dashboard Supabase (manual).
- Configurar reglas Cloudflare (guía ya entregada en conversación previa).

### Tarea 14 — Tests de seguridad automatizados

- **Esfuerzo:** alto (~1–2 días)
- Añadir un archivo `tests/e2e/security.spec.ts` con Playwright que verifique:
  - Llamar Edge Function sin JWT → 401.
  - INSERT a `orders` con `status='confirmed'` → policy violation.
  - SELECT a `orders` de otro `user_id` → fila vacía.
  - UPDATE a `internal_notes` siendo non-admin → trigger violation.
  - send-transactional-email con anon JWT → 403 (tras Sprint 1).
- **Beneficio:** previene regresiones futuras.

### Tarea 15 — Dependabot / Renovate

- Crear `.github/dependabot.yml` con configuración semanal para `npm`.

### Tarea 16 — Política de retención de logs

- Crear migración con `pg_cron` job que purgue `email_send_log` >90 días.

### Tarea 17 — Actualizar documentación (QW-7)

- `CLAUDE.md`: añadir las 5 Edge Functions nuevas + tablas de email infra + roles `pizzeria*`.
- `SKILLS.md`: actualizar "Architecture security summary" y la lista de "Known attack surfaces" con los hallazgos resueltos en Sprints 1–2.

---

## Dependencias entre tareas

```
Sprint 1:
  H-01 ────► (independiente)
  H-02 ────► (independiente)
  H-03 ────► (independiente)
  M-01 ────► (independiente)
  M-03 ────► (independiente)

Sprint 2:
  M-02 ────► (depende de M-01 cerrada)
  Tarea 7 (centralizar auth) ────► (depende de H-01 implementada)
  L-01, L-02, L-04, M-04 ────► (independientes)

Sprint 3:
  Tarea 14 (tests de seguridad) ────► (depende de todo Sprint 1+2)
  Resto ────► (independientes)
```

---

## Estimación total

| Sprint | Esfuerzo total | Resultado |
|---|---|---|
| Quick wins | ~1 h | Hallazgos triviales cerrados |
| Sprint 1 | 1–2 días | 0 highs, IDOR cerrado, npm audit limpio |
| Sprint 2 | 3–5 días | Race condition cerrada, hardening estructural |
| Sprint 3 | variable | Proceso continuo + monitoring |

**Recomendación:** ejecutar Quick wins + Sprint 1 antes del próximo despliegue a producción. Sprints 2 y 3 son seguimiento.

---

## Lo que requiere acción manual del usuario (no automatizable por el AI)

| Acción | Dónde | Cuándo |
|---|---|---|
| Confirmar dueño/decisión sobre bucket Storage público vs privado (M-04) | reunión interna | antes de Sprint 2 |
| Verificar logs de send-push-notification para confirmar L-01 | Supabase dashboard | Sprint 2 |
| Configurar rate limits Supabase Auth | Lovable dashboard / panel Supabase | en cualquier momento |
| Configurar rate limiting / WAF Cloudflare | Cloudflare dashboard | en cualquier momento |
| Verificar cabeceras HTTP servidas por Lovable edge (L-03) | `curl -I` desde terminal | Sprint 3 |
| Aplicar migraciones SQL nuevas en el SQL Editor | Supabase dashboard | tras cada migración del Sprint |
