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

---

## Known attack surfaces to audit

### 1. Edge Functions — missing authorization checks

All Edge Functions use `Access-Control-Allow-Origin: "*"` and none verify the caller's identity against the Supabase JWT. Critical ones:

| Function | Risk | What to check |
|---|---|---|
| `refund-order` | Anyone with a known `orderId` (UUID) can trigger a full Stripe refund | Add JWT verification; only admins should call this |
| `confirm-reservation` | Anyone with a `reservation_id` can confirm any reservation | Add JWT + admin role check |
| `auto-assign-reservation` | Accepts `is_admin: true` from the **request body** — client-supplied privilege escalation | `is_admin` must be derived from the verified JWT, not the request payload |
| `send-push-notification` | Accepts `{ test: true, user_id }` with no auth — anyone can trigger test pushes to any admin | Add JWT check; only admins should call directly |
| `create-payment-intent` | Low risk (amount is recalculated server-side), but no caller verification | Consider verifying the orderId belongs to the requesting user |

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

1. **New Edge Function**: check JWT auth, CORS origin, error message sanitization, and that `is_admin`/`user_id` are derived from the verified token, not the request body.
2. **New DB table/column**: check RLS is enabled, all four CRUD policies exist, sensitive columns are not user-writable.
3. **New migration**: search for `SECURITY DEFINER` — ensure `SET search_path = public` is set.
4. **New client feature that calls Supabase directly**: check that the operation cannot succeed with the `anon` role when it should require auth.
5. **Any rendering of user-supplied data**: confirm no `dangerouslySetInnerHTML`, and that `Json`-typed fields are treated as untrusted input.
