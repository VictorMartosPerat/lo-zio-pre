# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Keeping this file up to date

Before starting any significant change (new feature, refactor, new dependency, routing change, schema migration), update this file first to reflect the intended architecture. Keep it accurate as the codebase evolves.

## Security

For security reviews, attack surface analysis, RLS audits, and Edge Function authorization checks, refer to [`SKILLS.md`](./SKILLS.md). It contains the cybersecurity agent's full context for this architecture — known risks, existing protections, remediation patterns, and a per-change security review workflow.

### Pre-flight security checklist (MANDATORY before any change)

Apply this list **before writing code**, not after. Past audits caught regressions where a vulnerability fixed in one file was reintroduced in a sibling file written later. The 2026-05-09 audit found, for example:

- `AdminOrders.tsx:474` correctly validates `guest_phone` before using it in a `tel:` href.
- `IncomingOrderManager.tsx` (added later) used the same pattern **without validation**, reintroducing the XSS risk in a different component.

To prevent that class of regression, every change must answer the relevant questions below:

#### 1. Rendering user-supplied data
- [ ] Is the value rendered in `href={...}` / `src={...}` / `style={...}` / `dangerouslySetInnerHTML`? If yes:
  - For phone numbers: validate with `/^[+\d\s\-().]{1,20}$/` and fall back to `'#'`. Reference: `AdminOrders.tsx:474`.
  - For URLs: only allow `https://` and known domains; reject `javascript:` / `data:`.
  - Never use `dangerouslySetInnerHTML` with anything other than constants. Use JSX with `<strong>` etc.
- [ ] Free-text columns (`notes`, `guest_name`, `address`, `phone`, `message`, `internal_notes`, `food_preferences`) are protected by the `reject_html_input` trigger. **New free-text columns must be added to that trigger** (see migration `20260509000007_*.sql` for the pattern).

#### 2. New Edge Function
- [ ] Decide auth model up front and document it inside the function file as a top-of-file comment:
  - `verify_jwt = true` + the function checks `claims.role` (preferred for service-only functions, see `process-email-queue`).
  - `verify_jwt = true` + per-user authorization (caller must own the resource — verify via `auth.getUser()` + DB lookup).
  - `verify_jwt = true` + admin/staff role check (see `refund-order`, `confirm-reservation`).
  - `verify_jwt = false` + HMAC signature (only for external webhooks, see `handle-email-suppression`).
  - `verify_jwt = false` + DB webhook trigger (only for `notify-order-status` style flows where the function is called by a Postgres trigger; even then, never trust `record` field values for authorization).
- [ ] **`verify_jwt = true` is NOT sufficient on its own** — it accepts the anon JWT (the `VITE_SUPABASE_PUBLISHABLE_KEY` shipped to every browser). Every public-callable function must verify the caller's role/identity in code.
- [ ] Never trust fields like `user_id`, `is_admin`, `role`, `email` from `req.json()`. Always derive from the verified JWT (`auth.getUser()`).
- [ ] Catch errors and return a generic message to the caller. Log details server-side only.
- [ ] If `verify_jwt = false`, document why on the first comment line of the function.

#### 3. New table or column
- [ ] `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.
- [ ] All four CRUD policies (SELECT/INSERT/UPDATE/DELETE) explicitly defined for `anon` and `authenticated` as appropriate.
- [ ] `WITH CHECK` on INSERT/UPDATE prevents privileged columns being self-set (e.g. `status = 'pending'`, `payment_status = 'pending'`, `user_id = auth.uid()`).
- [ ] Sensitive columns (admin-only) protected by a BEFORE UPDATE trigger that compares OLD vs NEW (RLS `WITH CHECK` cannot do this — see `prevent_user_internal_notes_update` in migration 00006 for the pattern).
- [ ] All new free-text columns added to the `reject_html_input` trigger.

#### 4. New SQL function or trigger
- [ ] `SECURITY DEFINER SET search_path = public` (immune to search_path injection).
- [ ] If invoked from a trigger that calls `net.http_post` to an Edge Function, include the service-role key from Vault as `Authorization: Bearer ...` — otherwise `verify_jwt = true` will reject the call. See `notify_reservation_webhook` for the pattern.
- [ ] `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO service_role` on functions meant for service-role only (see `enqueue_email`, `read_email_batch` in `email_infra` migration).

#### 5. New client feature that calls Supabase directly
- [ ] If the operation should require auth, verify it cannot succeed with the `anon` role (try a manual `curl` with only the publishable key).
- [ ] If sending email via `send-transactional-email` from the client, expect a 403 if the recipient is not the authenticated user — the function will be locked down (Sprint 1 plan).

#### 6. New free-text input field in a form
- [ ] DB trigger covers it (see #1).
- [ ] React renders it with `{value}`, never via `dangerouslySetInnerHTML`.
- [ ] If it ends up in an `href`, see #1 (URL validation).

When in doubt, run the audit workflow described in [`SKILLS.md`](./SKILLS.md) before merging.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:8080
npm run build        # Production build
npm run lint         # ESLint check
npm run test         # Run unit tests (Vitest, single run)
npm run test:watch   # Run unit tests in watch mode
npx vitest run src/path/to/file.test.ts  # Run a single test file
npx playwright test  # Run E2E tests (requires dev server running)
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase project credentials
- `VITE_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (frontend only)

Stripe secret key and push notification VAPID keys are configured as Supabase Edge Function secrets, not in `.env`.

## Architecture Overview

**Stack:** React 18 + TypeScript, Vite, Tailwind CSS + shadcn/ui, Supabase (auth, DB, Edge Functions, Storage), Stripe, i18next (es/en/ca/it), PWA via `vite-plugin-pwa` with a custom service worker at `src/sw.ts`.

### Provider tree (`src/App.tsx`)

```
HelmetProvider → QueryClientProvider → AuthProvider → CartProvider → TooltipProvider → BrowserRouter
```

Global UI components (`CartDrawer`, `CartFloatingButton`, `MobileBottomNav`, `AdminFAB`, `InstallBanner`, `UpdateBanner`) are mounted inside `BrowserRouter` but outside the route tree so they persist across all pages.

### Auth & admin

- `useAuth` (`src/hooks/useAuth.tsx`) — wraps Supabase `onAuthStateChange`, provides `user`, `session`, `signOut`.
- `useIsAdmin` (`src/hooks/useIsAdmin.tsx`) — queries `user_roles` table for `role = 'admin'`, caches result in `localStorage` (`lozio_is_admin`) for instant re-hydration without a flash.
- `usePizzeriaRole` (`src/hooks/usePizzeriaRole.tsx`) — checks `pizzeriaTarragona` / `pizzeriaArrabassada` roles. Used by `IncomingOrderManager` to subscribe to the correct realtime channel and by RLS to scope order visibility to assigned store.

#### Roles (`app_role` enum)
- `admin` — full access via RLS `has_role(...,'admin')`.
- `pizzeriaTarragona`, `pizzeriaArrabassada` — staff scoped to one store; can SELECT/UPDATE only orders where `assigned_to` matches their store.
- `user` — default authenticated role (unused in code, falls through to per-row `auth.uid() = user_id` policies).

### Cart

`CartContext` (`src/contexts/CartContext.tsx`) persists cart state to `localStorage` (`lozio_cart`). Cart items support extras (`CartItemExtra`) and per-item notes. The drawer (`CartDrawer`) and floating button are rendered globally.

### Supabase integration

- Client: `src/integrations/supabase/client.ts`
- Types auto-generated: `src/integrations/supabase/types.ts` — **do not hand-edit**, regenerate with `supabase gen types typescript`.
- Edge Functions live in `supabase/functions/`:
  - `auto-assign-reservation` — public reservation creation (auth-aware: derives `user_id` and admin status from JWT).
  - `confirm-reservation` — admin only (admin JWT required).
  - `create-payment-intent` — server-side total calc; called from Checkout.
  - `refund-order` — admin only.
  - `notify-order-status` — DB-webhook-triggered email on order status change (`verify_jwt = false`).
  - `send-push-notification` — DB-webhook-triggered admin push; `test:true` path requires admin JWT.
  - `send-transactional-email` — enqueues emails into pgmq. **Currently callable by any anon JWT — to be restricted; see SECURITY_REMEDIATION_PLAN.md H-01.**
  - `process-email-queue` — pg_cron-driven dispatcher; service-role only.
  - `preview-transactional-email` — `LOVABLE_API_KEY` gated.
  - `handle-email-unsubscribe` — public (token-based, RFC 8058 one-click).
  - `handle-email-suppression` — Lovable webhook (HMAC-verified).
- Database migrations: `supabase/migrations/` (timestamped SQL files).

### Key domain logic (`src/lib/`)

- `storeHours.ts` — knows opening hours (19:00–23:30) and per-store closed days (Tarragona: Tuesday, Arrabassada: Monday). Use `isStoreOpen`, `getScheduleStatus`, `getAvailableDays`, `getTimeSlots` for all availability checks.
- `locations.ts` — static `locationsData` record with slug-keyed location info (3 venues: `tarragona`, `arrabassada`, `rincon`).
- `nearestStore.ts` — geolocation-based store selection.
- `availability.ts` — reservation slot availability from Supabase.
- `extras.ts` / `allergens.ts` / `upsell.ts` — menu item metadata.

### Routing (`src/App.tsx`)

| Path | Component |
|---|---|
| `/` | Index (landing page) |
| `/auth` | Auth |
| `/reset-password` | ResetPassword |
| `/perfil` | Profile |
| `/mis-reservas` | MyReservations |
| `/mis-pedidos` | MyOrders |
| `/pedido` | Checkout (wrapped in Stripe `<Elements>`) |
| `/pedido-confirmado` | OrderConfirmation |
| `/locales` | Locales |
| `/locales/:slug` | LocationDetail |
| `/resenas` | ReviewPage |
| `/admin` | Admin (tabbed: reservations, floor plan, orders link, products, customers, reviews, media, reports) |
| `/admin/pedidos/:store` | AdminOrders |

### Checkout & payments

`Checkout.tsx` supports delivery and pickup order types, ASAP or scheduled time slots, cash or Stripe card payment. Stripe `CardElement` calls the `create-payment-intent` Edge Function. Checkout wraps in `<Elements stripe={stripePromise}>` at the router level.

### Admin panel

`Admin.tsx` is guarded by `useIsAdmin`. It tabs across: reservations calendar, floor plan (`FloorPlan.tsx`), products (`AdminProducts.tsx`), customers (`AdminCustomers.tsx`), reviews (`AdminReviews.tsx`), media (`AdminMedia.tsx`), reports (`AdminReports.tsx`). Admin can receive real-time push notifications via `useAdminNotifications`.

### PWA / Service Worker

The custom SW (`src/sw.ts`) uses Workbox strategies. `vite-plugin-pwa` with `strategies: 'injectManifest'` compiles it. `UpdateBanner` detects SW updates and prompts the user to reload. `InstallBanner` shows the A2HS prompt.

### i18n

Translations in `src/i18n/locales/{es,en,ca,it}.json`. Default language is Spanish (`es`). Language is detected from `localStorage` then browser `navigator`. Use the `useTranslation` hook and `t('key')` calls throughout components.

### Path alias

`@/` resolves to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).
