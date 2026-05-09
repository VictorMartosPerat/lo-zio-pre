# Cybersecurity Agent — Skills & Context

This document briefs a security-focused Claude agent on the architecture, known attack surfaces, existing protections, and audit methodology for this repository (Lo Zio — React/Vite PWA + Supabase + Stripe).

---

## Architecture security summary

| Layer | Technology | Auth mechanism |
|---|---|---|
| Frontend | React 18 / Vite SPA | Supabase JWT (cookie-less, localStorage) |
| Database | Supabase Postgres | Row Level Security (RLS) + `has_role()` |
| Backend | Supabase Edge Functions (Deno) | SUPABASE_SERVICE_ROLE_KEY (server-only) |
| Payments | Stripe | Publishable key on client, secret key in Edge Function env |
| Push notifications | Web Push / VAPID | VAPID keys in Edge Function env; public key hardcoded in client (correct by spec) |
| Auth | Supabase Auth (email/password) | JWT, managed by Supabase |
| Admin role | `user_roles` table | `has_role(auth.uid(), 'admin')` SECURITY DEFINER function |

---

## What is already done correctly

- **Server-side price calculation**: `create-payment-intent` reads `order_items` from the DB via service role — the client amount is never trusted.
- **RLS on all tables**: Every table in `supabase/migrations/` has `ENABLE ROW LEVEL SECURITY`.
- **Admin check via SECURITY DEFINER**: `has_role()` (`supabase/migrations/20260309153026_*.sql`) is `SECURITY DEFINER SET search_path = public` — immune to search_path injection.
- **`user_roles` read policy**: Only `auth.uid() = user_id` — users cannot enumerate other users' roles.
- **Cart price not trusted**: Checkout writes items to `order_items` first, then the Edge Function recalculates the total from the DB row.
- **Admin cache is UI-only**: `localStorage` `lozio_is_admin` only affects rendering; actual admin actions are gated by RLS `has_role()` server-side.
- **Stored XSS hardening**: `reject_html_input` BEFORE INSERT/UPDATE trigger blocks `<tag`, `javascript:`, `data:` patterns in all free-text columns of `orders`, `reservations`, `reviews`, `profiles` (incl. `internal_notes` since migration 00007).
- **Path traversal hardening**: `media.file_path` has a CHECK constraint blocking `../`, absolute paths, and disallowed characters.
- **Enum integrity**: DB-level CHECK constraints on `status`, `payment_status`, `order_type`, `payment_method`, `location`, `category` columns prevent direct REST API from setting arbitrary values.
- **Anon INSERT scope**: orders and reservations REST inserts locked to `status = 'pending'` + valid enums (migration 00005).
- **internal_notes write protection**: BEFORE UPDATE trigger raises if a non-admin tries to change `internal_notes` (migration 00006).
- **Admin Edge Function authorization**: `refund-order`, `confirm-reservation`, `auto-assign-reservation` (admin-mode), `send-push-notification` (test path) all verify the JWT and check `user_roles` for admin role.
- **Service-role-only functions**: `process-email-queue` checks `claims.role === 'service_role'` in addition to gateway JWT.
- **Webhook authentication**: `handle-email-suppression` uses HMAC verification via `@lovable.dev/webhooks-js`.
- **Email send deduplication**: unique partial index on `email_send_log(message_id) WHERE status = 'sent'`.
- **CSP**: strict policy in `index.html` (no `unsafe-inline` for scripts, no `unsafe-eval`).
- **Auth error UX**: translated, generic error messages for rate-limit, invalid credentials, email-taken, etc., in all 4 languages.

---

## Known attack surfaces to audit

### 0. Edge Functions — current state (post 2026-05-09 audit)

All Edge Functions use `Access-Control-Allow-Origin: "*"`. Per-function status:

| Function | verify_jwt | Auth model | Status |
|---|---|---|---|
| `refund-order` | true | Admin role check in code | ✅ Done |
| `confirm-reservation` | true | Admin role check in code | ✅ Done |
| `auto-assign-reservation` | (default true) | Admin/user_id derived from JWT | ✅ Done (was: client-supplied `is_admin` and `user_id`) |
| `send-push-notification` | (default true) | Test path checks admin JWT; webhook path open | ✅ Done |
| `create-payment-intent` | (default true) | No per-user check; server-side total calc only | ⚠ Low risk — consider adding owner check (P3) |
| `notify-order-status` | false (DB webhook) | No auth; relies on trigger | ✅ Errors sanitized (was leaking) |
| `send-transactional-email` | true | service_role OR staff OR self-send | ✅ Done (was: accepted anon JWT — phishing vector) |
| `process-email-queue` | true | service_role role check | ✅ Done |
| `preview-transactional-email` | false | LOVABLE_API_KEY bearer (not constant-time) | ⚠ LOW — timing-attack theoretical |
| `handle-email-unsubscribe` | false | Token from URL/body | ✅ Done (atomic check-and-update) |
| `handle-email-suppression` | false | HMAC signature (Lovable webhook lib) | ✅ Done |

**Remediation pattern for Edge Functions (Deno):**
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const authHeader = req.headers.get("Authorization");
if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } }
);

const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
```

### 2. `auto-assign-reservation` — client-controlled privilege flag

`is_admin` is read from `req.json()` without verifying the caller's role. This allows any caller to skip the guest count validation (1–10) and potentially disrupt availability logic.

### 3. CORS wildcard on sensitive functions

`Access-Control-Allow-Origin: "*"` is acceptable for public-facing read endpoints, but `refund-order` and `create-payment-intent` should restrict to the production domain or at minimum require a valid Supabase JWT.

### 4. Information leakage in Edge Function errors

All functions return `error: msg` (the raw JavaScript error message) with HTTP 500. Internal DB errors, Stripe error details, and configuration state can be disclosed.

**Fix:** Map internal errors to generic messages before responding; log details only server-side.

### 5. `profiles.internal_notes` — admin-only field, no write restriction

The `internal_notes` column (`src/integrations/supabase/types.ts`) is in the same `profiles` table that users can `UPDATE` on themselves. Verify the RLS `UPDATE` policy restricts which columns a user can write — Postgres RLS does not natively restrict per-column on `UPDATE` without column-level security or a `WITH CHECK` expression that validates `internal_notes` is unchanged.

### 6. `profiles.special_dates` — untyped JSON field

Stored as `Json`. If this value is ever rendered with `dangerouslySetInnerHTML` or interpolated into SQL/shell, it is an injection vector. Audit all rendering paths for this field.

### 7. Rate limiting — none

No rate limiting exists on Edge Functions or on Supabase Auth. Brute-force on `/auth` (login) and spam on `auto-assign-reservation` (public insert) are unmitigated. Supabase Auth has configurable rate limits in the dashboard; Edge Function rate limiting requires an external layer (Cloudflare, etc.) or manual IP tracking.

### 8. `push_subscriptions` — endpoint ownership not enforced

`disablePush` deletes by `endpoint` (`eq('endpoint', sub.endpoint)`) without scoping to `user_id`. If a user knows another user's push endpoint string, they can unsubscribe them. Verify the RLS `DELETE` policy on `push_subscriptions` scopes to `auth.uid() = user_id`.

### 9. Order ownership on checkout

`create-payment-intent` fetches `order_items` by `orderId` but does not verify the order belongs to the requesting user. A logged-in user who knows another user's `orderId` could create a payment intent for that order (though they would be paying for it themselves — financial impact is low but the access control gap should be closed).

---

## RLS audit checklist

For every table in `supabase/migrations/`, verify:

- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is present
- [ ] `SELECT` policy: does not expose rows from other users without `has_role(auth.uid(), 'admin')`
- [ ] `INSERT` policy: `WITH CHECK` clause prevents inserting rows owned by another `user_id`
- [ ] `UPDATE` policy: `USING` clause prevents updating rows owned by another user; sensitive fields (e.g. `internal_notes`, `role`) cannot be self-modified
- [ ] `DELETE` policy: exists and is scoped correctly
- [ ] No policy uses `TO public` or `TO anon` on sensitive tables
- [ ] `anon` role can only insert into explicitly public tables (`reservations`, `orders`)

---

## Dependency surface

- Stripe SDK: `stripe@14.21.0` (pinned in Edge Functions via `esm.sh`)
- `web-push@3.6.7` (npm, used in `send-push-notification`)
- Frontend deps: managed by `package.json` / `bun.lock`
- Run `npm audit` for known CVEs in frontend deps
- Edge Function deps are fetched from `deno.land` and `esm.sh` at deploy time — no lock file; pin versions explicitly and review on upgrades

---

## Security review workflow for this repo

This list complements the [pre-flight checklist in CLAUDE.md](./CLAUDE.md#pre-flight-security-checklist-mandatory-before-any-change). Use that one *before* writing code; use this one *after* a change is implemented to verify nothing slipped:

1. **New Edge Function**: check `verify_jwt` setting, CORS origin, error message sanitization, and that `is_admin`/`user_id` are derived from the verified token, not the request body. **`verify_jwt = true` alone is insufficient — it accepts the anon JWT shipped to every browser.**
2. **New DB table/column**: check RLS is enabled, all four CRUD policies exist, sensitive columns are not user-writable. New free-text columns must be added to the `reject_html_input` trigger.
3. **New migration**: search for `SECURITY DEFINER` — ensure `SET search_path = public` is set. If the migration adds a trigger that calls `net.http_post` to an Edge Function, ensure the call includes the service-role bearer token from Vault.
4. **New client feature that calls Supabase directly**: check that the operation cannot succeed with the `anon` role when it should require auth.
5. **Any rendering of user-supplied data**:
   - No `dangerouslySetInnerHTML` with anything that isn't a constant.
   - `href={...}`, `src={...}`, `style={...}` with user data must be validated with a strict regex (e.g. phone numbers: `/^[+\d\s\-().]{1,20}$/`). **The 2026-05-09 audit found this regression: `IncomingOrderManager.tsx` reintroduced an unvalidated `tel:` href that had been correctly handled in `AdminOrders.tsx`.** Always grep for similar patterns when adding new components that handle the same data.
   - `Json`-typed fields are untrusted input.
6. **Regression discipline**: when fixing a vulnerability in one file, `grep` the codebase for the same data flow and apply the fix everywhere. Add a comment near the fix referencing the CWE so future readers know why the regex/check exists.
