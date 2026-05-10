# Reporte de Auditoría de Seguridad

**Proyecto:** Lo Zio (PRE) — pizzeriaslozio.com
**Fecha:** 2026-05-09
**Tipo:** Auditoría independiente (revisión completa)
**Scope:** Frontend React/Vite, Supabase (Postgres+RLS, Edge Functions, Storage), Stripe, infraestructura de email

---

## Resumen ejecutivo

El proyecto se encuentra en un estado de seguridad **maduro** tras la remediación de la auditoría previa: las vulnerabilidades críticas de RLS, IDOR, XSS almacenado vía API REST, escalación de privilegios y autorización en Edge Functions están resueltas. Las protecciones defensivas en profundidad son sólidas (triggers de sanitización HTML, constraints de path traversal, validación de enums a nivel BD, CSP).

Sin embargo, la nueva infraestructura de email transaccional introduce un **vector de abuso alto** (envío de email no autorizado a través del dominio del cliente), persiste una **vulnerabilidad XSS conocida** sin parchear en un componente del panel admin, una **race condition en la asignación de mesas**, y existen **dependencias npm con CVEs conocidos** (incluida una en `react-router-dom` directa).

Ninguna vulnerabilidad permite acceso no autenticado a datos sensibles ni ejecución remota de código. Las explotaciones requieren autenticación anónima (publishable key, públicamente disponible) o conocimiento de IDs internos.

## Métricas

| Severidad | Cantidad |
|---|---:|
| Críticas | 0 |
| Altas | 3 |
| Medias | 4 |
| Bajas | 7 |
| Informativas | 4 |
| **Total** | **18** |

---

## Hallazgos detallados

### [ALTA] H-01 — Envío de email transaccional accesible para cualquier visitante (vector de phishing) — ✅ RESUELTO 2026-05-09

- **Ubicación:** `supabase/functions/send-transactional-email/index.ts` + `supabase/config.toml`
- **Descripción:** La función está configurada con `verify_jwt = true`, lo que en Supabase acepta el JWT anónimo (la `VITE_SUPABASE_PUBLISHABLE_KEY` que se sirve a cualquier visitante en el bundle JS). La función no verifica que el `recipientEmail` corresponda al usuario autenticado ni que el caller sea admin/service_role. Combinado con `templateData` arbitrario y `templateName` de un registro pequeño pero suficiente, permite enviar emails desde el dominio verificado de la pizzería a cualquier destinatario.
- **Prueba de concepto:**
  ```bash
  curl -X POST "https://lnrnyahzkqqnvlpzrdlv.supabase.co/functions/v1/send-transactional-email" \
    -H "Authorization: Bearer <VITE_SUPABASE_PUBLISHABLE_KEY>" \
    -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>" \
    -H "Content-Type: application/json" \
    -d '{
      "templateName": "order-status-update",
      "recipientEmail": "victima@example.com",
      "templateData": {
        "guestName": "Cliente",
        "shortId": "PIZZA",
        "totalAmount": 999.00,
        "status": "confirmed",
        "estimatedMinutes": 30,
        "readyTime": "20:30"
      }
    }'
  ```
  El email llega desde `notify.pizzeriaslozio.com` con SPF/DKIM válidos. El destinatario recibe un mensaje aparentemente legítimo del restaurante.
- **Impacto:** (a) Phishing dirigido usando la reputación del dominio. (b) Abuso de la cuota de envío. (c) Daño a deliverability si víctimas marcan como spam → afecta a clientes legítimos. (d) Cuotas de Lovable/Mailgun consumidas por terceros.
- **Remediación:** verificar el rol del JWT en la función. Solo aceptar si:
  - `role === 'service_role'` (llamadas desde otras Edge Functions / triggers como `notify-order-status`), **o**
  - El JWT corresponde a un usuario autenticado **Y** el `recipientEmail` coincide con `user.email` (auto-envío permitido), **o**
  - El usuario tiene rol `admin` o `pizzeriaTarragona` / `pizzeriaArrabassada` (envíos legítimos desde el panel).

  Patrón sugerido (al inicio de la función):
  ```typescript
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const claims = parseJwtClaims(token);

  // Allow service role unconditionally
  if (claims?.role !== "service_role") {
    // Otherwise, require an authenticated user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader! } }
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const isStaff = await checkStaffRole(supabase, user.id);
    const isSelf = recipientEmail.toLowerCase() === user.email?.toLowerCase();
    if (!isStaff && !isSelf) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
  }
  ```
- **Referencia:** CWE-285 (Improper Authorization), OWASP API1:2023 (Broken Object Level Authorization), CWE-799 (Improper Control of Interaction Frequency).

---

### [ALTA] H-02 — Inyección XSS en `tel:` href en el panel de pedidos entrantes

- **Ubicación:** `src/components/IncomingOrderManager.tsx:316`
- **Descripción:** El componente renderiza `<a href={`tel:${current.guest_phone}`}>` sin validar `guest_phone`. Es el mismo patrón de vulnerabilidad que se corrigió en `AdminOrders.tsx` (líneas 482 y 605) tras la auditoría previa, pero este componente fue añadido posteriormente y reintrodujo el sink. La defensa en profundidad existe (trigger `reject_html_input` rechaza `<`, `javascript:`, `data:`), pero un atacante que encuentre un bypass de la regex (e.g. caracteres unicode, normalización) tendría un sink XSS directo en una pantalla que se muestra a los staff de la pizzería.
- **Prueba de concepto:** si el trigger fuese eludido y `guest_phone` contuviera `javascript:alert(document.cookie)`, hacer click en el botón ejecutaría JS en el contexto del admin/staff, robando su sesión.
- **Impacto:** XSS reflejado/almacenado contra usuarios privilegiados (staff de pizzería) → robo de sesiones admin, acceso a datos de pedidos.
- **Remediación:** aplicar la misma validación regex que en `AdminOrders.tsx`:
  ```tsx
  href={/^[+\d\s\-().]{1,20}$/.test(current.guest_phone) ? `tel:${current.guest_phone}` : '#'}
  ```
- **Referencia:** CWE-79 (XSS), OWASP A03:2021.

---

### [ALTA] H-03 — Dependencias npm con CVEs conocidos (`react-router-dom`, `vite`, `postcss`)

- **Ubicación:** `package.json`
- **Descripción:** `npm audit` reporta 21 vulnerabilidades (12 altas, 6 moderadas, 3 bajas). Las más relevantes:
  | Paquete | Severidad | CVE | Producción/Dev |
  |---|---|---|---|
  | `react-router-dom` (directa) | HIGH | GHSA-2w69-qvjg-hvjx (XSS via Open Redirects, CWE-79) | **producción** |
  | `vite` (directa) | MODERATE | GHSA-67mh-4wv8-2f99 (esbuild dev-server CORS bypass) | dev |
  | `postcss` (directa) | MODERATE | — | build |
  | `jsdom` (directa) | LOW | — | test |
  | `@remix-run/router` (transitiva) | HIGH | GHSA-2w69-qvjg-hvjx | producción |
  | `serialize-javascript` (transitiva) | HIGH | — | build (workbox) |
  | `lodash` (transitiva) | HIGH | — | build chain |
- **Impacto:** la CVE de `react-router-dom` puede explotarse si se usan rutas con redirección controlada por query string (no parece el caso aquí, pero hay que verificar). Las CVEs de `vite`/`esbuild` solo afectan al servidor de desarrollo. Las de la cadena de build no afectan al runtime.
- **Remediación:**
  ```bash
  npm audit fix          # arregla la mayoría sin breaking changes
  # Si quedan: npm audit fix --force, revisando breaking changes
  ```
  Verificar manualmente la CVE de react-router buscando `useNavigate(...untrusted)` y `<Link to={untrusted}/>`.
- **Referencia:** CWE-1395 (Dependency on Vulnerable Third-Party Component).

---

### [MEDIA] M-01 — IDOR en `auto-assign-reservation`: `user_id` aceptado del request body

- **Ubicación:** `supabase/functions/auto-assign-reservation/index.ts:99`
- **Descripción:** La función inserta la reserva con `user_id: user_id || null`. El campo se lee de `req.json()` sin validar contra el JWT del caller. Un atacante autenticado puede atribuir reservas a la cuenta de otro usuario (`MyReservations` mostrará reservas falsas en su lista), o un atacante anónimo puede contaminar el historial de cualquier usuario cuyo UUID conozca.
- **Prueba de concepto:**
  ```bash
  curl -X POST "https://lnrnyahzkqqnvlpzrdlv.supabase.co/functions/v1/auto-assign-reservation" \
    -H "Authorization: Bearer <publishable_key>" \
    -H "Content-Type: application/json" \
    -d '{"location":"tarragona","guest_name":"X","phone":"+34000",...,"user_id":"<UUID_DE_LA_VICTIMA>"}'
  ```
  La víctima ve la reserva fantasma en `/mis-reservas`.
- **Impacto:** confusión / daño reputacional ("¿por qué tengo reservas que no hice?"). No expone datos. Bajo si los UUIDs no se enumeran fácilmente, pero los UUIDs aparecen en URLs y logs.
- **Remediación:** derivar `user_id` del JWT verificado:
  ```typescript
  // Al inicio, después de obtener el user del JWT:
  const verifiedUserId = user?.id ?? null;  // null para reservas de invitado

  // Más abajo, ignorar req.body.user_id y usar:
  user_id: verifiedUserId,
  ```
- **Referencia:** CWE-639 (Authorization Bypass Through User-Controlled Key), OWASP API1:2023.

---

### [MEDIA] M-02 — Race condition (TOCTOU) en asignación de mesas — ✅ RESUELTO 2026-05-09

- **Ubicación:** `supabase/migrations/20260324222504_*.sql` (función `find_available_tables_multi`) + `supabase/functions/auto-assign-reservation/index.ts:61–108`
- **Descripción:** la función Edge llama `find_available_tables_multi` (que solo lee), recibe IDs de mesas libres, y luego ejecuta un INSERT en `reservations`. No hay locking entre lectura e inserción. Dos clientes que reserven el mismo slot horario al mismo tiempo pueden recibir el mismo `table_id` y ambos completar la inserción → doble booking.
- **Prueba de concepto:** lanzar dos `POST /functions/v1/auto-assign-reservation` casi simultáneos para la misma fecha/hora/local con `< 100ms` de diferencia, ambos con un solo cliente. Reproduce con probabilidad alta bajo carga.
- **Impacto:** doble reserva, conflicto en floor plan, intervención manual del staff. No es un fallo de seguridad puro pero es un fallo de integridad explotable y reportable.
- **Remediación:** opciones (preferida primero):
  1. **Constraint EXCLUDE GiST**: añadir un índice de exclusión sobre `(table_id, location, reservation_date) WITH btree, tsrange(time_window) WITH &&` para que el segundo INSERT falle por constraint, y manejar el error en la función Edge para reintentar con otra mesa.
  2. **Advisory lock**: `SELECT pg_advisory_xact_lock(hashtext(_location || _date::text))` al inicio de una función PL/pgSQL que englobe lectura + insert atómicamente.
  3. **`SELECT … FOR UPDATE`** sobre las mesas candidatas dentro de una transacción explícita.
- **Referencia:** CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization), CWE-367 (TOCTOU).

---

### [MEDIA] M-03 — Fuga de mensajes de error internos en `notify-order-status`

- **Ubicación:** `supabase/functions/notify-order-status/index.ts:97`
- **Descripción:** la función devuelve `JSON.stringify({ error: msg })` con el mensaje raw de la excepción. Otras Edge Functions ya fueron sanitizadas (`refund-order`, `confirm-reservation`, `create-payment-intent`, etc.) pero esta fue omitida. Aunque la función está marcada `verify_jwt = false` (la llama el webhook de BD), un atacante puede llamarla directamente y leer mensajes de error que pueden revelar detalles del esquema, claves faltantes, etc.
- **Impacto:** information disclosure menor. Útil en fase de reconocimiento.
- **Remediación:**
  ```typescript
  } catch (error: unknown) {
    console.error("Error in notify-order-status:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "Notification failed." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  ```
- **Referencia:** CWE-209 (Information Exposure Through an Error Message).

---

### [MEDIA] M-04 — Bucket de Storage `media` totalmente público, sin restricción de listado — ✅ RESUELTO 2026-05-10 (riesgo mitigado por allowlist MIME)

- **Ubicación:** `supabase/migrations/20260330201052_*.sql` línea 6 (`public = true`)
- **Descripción:** el bucket `media` es público (lectura sin autenticación) con política de SELECT `using (true)`. Los uploads están restringidos a admins (correcto), pero cualquiera puede leer cualquier ruta dentro del bucket. Si un admin sube por error un documento sensible (un JSON con datos de clientes, un CSV de pedidos, etc.) sería público.
- **Impacto:** dependiente del contenido. Para fotos públicas de comida es lo correcto. Para cualquier documento privado sería leak total.
- **Remediación aplicada:** Opción 1 (mantener público pero restringido). Verificación posterior reveló que el bucket ya tiene `allowed_mime_types = ['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']` configurado en migration `20260330201052_*.sql`. Supabase Storage rechaza al subir cualquier MIME fuera de esa lista — no es posible subir PDFs, CSVs ni documentos. Documentado en `CLAUDE.md` para no ampliar la lista en el futuro.
- **Referencia:** CWE-200 (Exposure of Sensitive Information), CWE-732 (Incorrect Permission Assignment).

---

### [BAJA] L-01 — `notify_push_on_reservation` posiblemente no funcional (llama función protegida sin auth)

- **Ubicación:** `supabase/migrations/20260416223708_*.sql`
- **Descripción:** el trigger BD llama a `send-push-notification` vía `net.http_post()` **sin Authorization header**. Como `send-push-notification` no aparece en `config.toml`, debería estar usando el default `verify_jwt = true`, lo cual rechazaría la llamada. Si realmente es así, las notificaciones push podrían estar fallando silenciosamente (la función trigger captura excepciones y devuelve `RETURN NEW`).
- **Impacto:** funcionalidad rota, no security. Pero **requiere verificación manual**: comprobar logs de la función `send-push-notification` o realizar una reserva real y validar que la notificación llega al admin.
- **Remediación:** dos opciones:
  1. Añadir `Authorization: Bearer <service_role_key>` desde Vault al `net.http_post`. Es lo que hace `notify_reservation_webhook`.
  2. Añadir `[functions.send-push-notification] verify_jwt = false` al `config.toml` y confiar en la verificación interna de admin que ya tiene la función para el path `test:true`.
- **Severidad:** baja (no abre brecha; potencial bug funcional). **Requiere verificación manual.**

---

### [BAJA] L-02 — Comparación de secretos no constante en tiempo (timing oracle)

- **Ubicación:** `supabase/functions/preview-transactional-email/index.ts:32`
- **Descripción:** `if (token !== apiKey)` compara el bearer token con `LOVABLE_API_KEY` usando `!==` JS estándar (short-circuit, no constant-time). En teoría se puede medir microsegundos a través de la red para inferir prefijos del secreto.
- **Impacto:** prácticamente no explotable a través de internet (jitter de red >> diferencia de timing). En infraestructura compartida con tiempos predecibles, marginalmente posible.
- **Remediación:**
  ```typescript
  function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const aBytes = new TextEncoder().encode(a);
    const bBytes = new TextEncoder().encode(b);
    let diff = 0;
    for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
    return diff === 0;
  }
  if (!timingSafeEqual(token ?? "", apiKey)) { /* 401 */ }
  ```
- **Referencia:** CWE-208 (Information Exposure Through Timing Discrepancy).

---

### [BAJA] L-03 — Cabeceras de seguridad HTTP faltantes (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)

- **Ubicación:** `index.html` (solo CSP presente)
- **Descripción:** existe un meta CSP correcto, pero no hay otras cabeceras defensivas. Estas se establecen normalmente a nivel de servidor/CDN. Como el deployment es vía Lovable Cloud, hay que verificar qué cabeceras envía el edge.
- **Comprobación recomendada:**
  ```bash
  curl -I https://pizzeriaslozio.com/
  ```
  Verificar la presencia de:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (o `frame-ancestors` en CSP — ya implícito)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
- **Remediación:** si Lovable no las envía, añadirlas a `index.html` como `<meta http-equiv>` (no funcionan para HSTS, sí para algunas otras), o solicitar a Lovable / configurar Cloudflare en frente.
- **Referencia:** OWASP Secure Headers Project.

---

### [BAJA] L-04 — `internal_notes` no incluido en el trigger de sanitización HTML

- **Ubicación:** `supabase/migrations/20260509000002_input_sanitization_trigger.sql:37–43`
- **Descripción:** el trigger `reject_html_input` valida `full_name`, `address`, `food_preferences` en `profiles` pero no `internal_notes`. Solo admins pueden escribirlo (trigger 00006), pero un admin malicioso o comprometido podría inyectar HTML que se renderice contra otros admins en `AdminCustomers.tsx` o `FloorPlan.tsx`.
- **Impacto:** XSS admin-to-admin (privilege necessary).
- **Remediación:** añadir validación al trigger:
  ```sql
  IF (NEW.internal_notes IS NOT NULL AND NEW.internal_notes ~* html_pat) THEN
    RAISE EXCEPTION 'Input contains invalid characters' USING ERRCODE = 'check_violation';
  END IF;
  ```
- **Referencia:** CWE-79 (defense in depth).

---

### [BAJA] L-05 — Token de unsubscribe en query string

- **Ubicación:** `src/pages/Unsubscribe.tsx:30`, `supabase/functions/handle-email-unsubscribe/index.ts:35`
- **Descripción:** los tokens de unsubscribe se transmiten como `?token=...`. Tokens en URL pueden filtrarse vía: historial del navegador, headers Referer, logs de servidor, función "compartir URL".
- **Impacto:** mínimo. Tokens son single-use, sin valor más allá de unsuscribir un email. Sin embargo, un compañero / admin que mire por encima del hombro podría usar el token.
- **Remediación:** la implementación actual ya soporta POST con token en body (RFC 8058 one-click). Hacer que la página `/unsubscribe` valide via POST en lugar de GET con query.
- **Referencia:** CWE-598 (Use of GET Request Method With Sensitive Query Strings).

---

### [BAJA] L-06 — `dangerouslySetInnerHTML` con interpolación de strings traducidos

- **Ubicación:** `src/components/ReservationSection.tsx:433–435`
- **Descripción:** se interpolan claves i18n (`t("reservation.durationWarning")`) dentro de un template HTML. Las claves vienen de los JSON de traducción del proyecto (controlados), no de input de usuario. Es seguro funcionalmente pero es un code smell que invita a errores futuros.
- **Remediación:** reescribir con JSX:
  ```tsx
  <AlertDescription className="...">
    {t("reservation.durationWarning")} <strong>{t("reservation.durationTime")}</strong> {t("reservation.durationWarningPost")}
  </AlertDescription>
  ```
- **Referencia:** CWE-79 (defensive coding).

---

### [BAJA] L-07 — JWT en localStorage (vector XSS para token theft)

- **Ubicación:** `src/integrations/supabase/client.ts:13`
- **Descripción:** los tokens de Supabase se persisten en `localStorage`. Cualquier XSS exitosa puede leerlos y usarlos hasta que expiren. Trade-off típico de SPAs (httpOnly cookies son inviables sin un backend propio). La CSP estricta del proyecto mitiga el riesgo.
- **Impacto:** depende de la presencia de XSS. La CSP actual (script-src 'self' https://js.stripe.com) bloquea cargar scripts externos, lo cual reduce drásticamente la superficie.
- **Remediación:** mantener (es el patrón estándar de Supabase); reforzar CSP eliminando `'unsafe-inline'` para style-src cuando sea factible.
- **Referencia:** CWE-922 (Insecure Storage of Sensitive Information).

---

### [INFO] I-01 — `CLAUDE.md` y `SKILLS.md` desactualizados

- **Ubicación:** `CLAUDE.md` (sección Edge Functions), `SKILLS.md` (architecture summary)
- **Descripción:** ambos documentos listan 6 Edge Functions; actualmente existen 12 (5 nuevas: `handle-email-suppression`, `handle-email-unsubscribe`, `preview-transactional-email`, `process-email-queue`, `send-transactional-email`). El componente `AdminUserRoles.tsx` y los roles `pizzeriaTarragona`/`pizzeriaArrabassada` tampoco están documentados.
- **Recomendación:** actualizar antes del próximo cambio significativo, según la propia regla del repositorio.

---

### [INFO] I-02 — `lovable-tagger` en producción

- **Ubicación:** `vite.config.ts:17` → `mode === "development" && componentTagger()`
- **Descripción:** el tagger se carga solo en desarrollo. ✅ Correcto.

---

### [INFO] I-03 — Source maps no expuestos en producción

- **Ubicación:** verificación en `dist/` tras `npm run build`
- **Descripción:** no se generan `.map` files en el build de producción. ✅ Correcto.

---

### [INFO] I-04 — Buenas prácticas detectadas (defensa en profundidad sólida)

- `process-email-queue` valida `claims.role === 'service_role'` además del JWT del gateway. ✅
- `handle-email-suppression` verifica HMAC del webhook con `verifyWebhookRequest`. ✅
- `email_send_log` tiene un índice único parcial sobre `message_id WHERE status = 'sent'` que previene envíos duplicados a nivel BD. ✅
- `find_available_tables_multi`, `has_role`, `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq` todas son `SECURITY DEFINER SET search_path = public` (immune a search_path injection). ✅
- Las RPC functions de email están con `REVOKE EXECUTE ... FROM PUBLIC` y `GRANT TO service_role`. ✅
- Triggers de sanitización HTML, constraints de path traversal, validación de enums a nivel BD están todos en producción. ✅
- CSP estricto, sin `'unsafe-inline'` para script-src, sin `unsafe-eval`. ✅
- Errores sanitizados en la mayoría de Edge Functions críticas. ✅

---

## Resumen de dependencias vulnerables

| Paquete | Versión actual | Severidad | CVE / Aviso | Versión parcheada | Producción/Build/Dev/Test |
|---|---|---|---|---|---|
| `react-router-dom` | 6.30.1 | HIGH | GHSA-2w69-qvjg-hvjx (XSS) | última 6.x | **producción** |
| `@remix-run/router` (transit.) | ≤1.23.1 | HIGH | GHSA-2w69-qvjg-hvjx | >1.23.1 | producción |
| `vite` | 5.4.19 | MODERATE | GHSA-67mh-4wv8-2f99 (esbuild) | última 5.x | dev |
| `postcss` | 8.5.6 | MODERATE | — | última 8.x | build |
| `jsdom` | 20.x | LOW | http-proxy-agent transitive | 26+ | test |
| `serialize-javascript` | < parche | HIGH | — | última | build (workbox) |
| `@babel/plugin-transform-modules-systemjs` | <7.29.4 | HIGH | GHSA-fv7c-fp4j-7gwp | 7.29.4+ | build |
| `lodash` (transit.) | < parche | HIGH | — | última | build chain |
| `glob`, `minimatch`, `flatted`, `fast-uri` | varias | HIGH/MOD | — | últimas | build/test |
| `brace-expansion` | <1.1.13 | MODERATE | GHSA-f886-m6hf-6m8v (DoS) | 1.1.13+ | múltiples |
| `js-yaml`, `yaml` | varias | MODERATE | — | últimas | build/test |
| `@tootallnate/once`, `http-proxy-agent` | varias | LOW | — | — | test |

**Acción inmediata:** `npm audit fix` (reintentar cualquier package afectado tras `rm -rf node_modules package-lock.json && npm install`).

---

## Checklist de cabeceras de seguridad

| Cabecera | Estado | Notas |
|---|---|---|
| Content-Security-Policy | ✅ Present (meta) | `index.html:30-32` — estricta, bloquea inline scripts |
| Strict-Transport-Security | ❓ Verificar | Debe servirla el edge (Lovable / Cloudflare) |
| X-Content-Type-Options | ❓ Verificar | `nosniff` recomendado |
| X-Frame-Options | ❓ Verificar | `frame-ancestors` ausente en CSP — añadir o usar X-Frame-Options |
| Referrer-Policy | ❓ Verificar | `strict-origin-when-cross-origin` recomendado |
| Permissions-Policy | ❓ Verificar | Restringir camera, microphone, etc. |
| Cross-Origin-Opener-Policy | ❌ Ausente | `same-origin` recomendado |
| Cross-Origin-Embedder-Policy | ❌ Ausente | Opcional |

**Verificación en 30 segundos:**
```bash
curl -sI https://pizzeriaslozio.com/ | grep -iE "strict-transport|x-frame|x-content|referrer|permissions"
```

---

## Recomendaciones generales

### Procesos
1. **CI con `npm audit`** que falle el build si aparecen vulnerabilidades de severidad alta o crítica nuevas. Permitir fail moderate como warning.
2. **Renovate / Dependabot** activado en GitHub para PRs automáticos de actualización.
3. **Re-ejecutar esta auditoría** cada vez que se añada una nueva Edge Function o tabla con RLS.
4. **Mantener `CLAUDE.md` + `SKILLS.md` actualizados** según la regla del repositorio — están desactualizados ahora.

### Arquitectura
5. **Layer de rate limiting global**: Cloudflare delante del frontend + límites de Auth en Supabase (ambos pendientes según conversación previa). Esto cubre el resto de Edge Functions sin requerir código en cada una.
6. **Centralizar la verificación de JWT/roles en Edge Functions**: extraer un helper en `supabase/functions/_shared/auth.ts` con `requireUser()`, `requireAdmin()`, `requireServiceRole()` para evitar copiar/pegar el patrón en cada función (y evitar omisiones como `notify-order-status`).
7. **Tests de seguridad automatizados**: Playwright tests que intenten:
   - Llamar Edge Functions sin JWT.
   - INSERT directo a `orders`/`reservations` con campos privilegiados (`status='confirmed'`, `payment_status='paid'`).
   - SELECT a `orders` de otros usuarios.
   - UPDATE a `internal_notes` siendo non-admin.

### Monitoring
8. **Alerts en logs de Supabase** para:
   - 4xx en Edge Functions (potencial scanning).
   - Excepciones del trigger `reject_html_input` (intentos de XSS confirmados).
   - 410 GONE responses en `send-push-notification` (subscripciones expiradas — limpieza ya implementada).

### Privacidad / GDPR
9. **PII en logs**: `console.log` actuales en Edge Functions imprimen `recipientEmail`, `guest_name`, etc. en plano. La función `handle-email-suppression` ya redacta (parcialmente) los emails. Aplicar el mismo patrón en el resto.
10. **Política de retención de `email_send_log`**: actualmente sin TTL. Considerar un cron que purgue rows >90 días.
