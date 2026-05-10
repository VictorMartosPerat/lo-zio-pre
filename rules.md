# Application Rules — Source of Truth for Tests

This document is the canonical description of how Lo Zio is supposed to behave.
Tests reference rule IDs; failures should cite the rule that was violated. When
behavior changes intentionally, update both this file and the affected tests in
the same PR.

Last verified against code: 2026-05-10. Update this date whenever you re-verify.

---

## How rule IDs work

Format: `R-<DOMAIN>-<NUMBER>`. Domain prefixes:

| Prefix | Domain |
|---|---|
| `LOC` | Locations and venues |
| `SCH` | Opening schedules |
| `RES` | Reservations |
| `TBL` | Tables and capacity |
| `ORD` | Orders (general) |
| `PAY` | Payments (cash, Stripe) |
| `AUTH` | Authentication and sessions |
| `PROF` | User profiles |
| `ROLE` | Roles and authorization |
| `RLS` | Row Level Security (per table) |
| `ADM` | Admin panel |
| `REV` | Reviews |
| `EMAIL` | Email infrastructure |
| `PUSH` | Push notifications |
| `PWA` | PWA / Service Worker |
| `I18N` | Translations |
| `INP` | Input validation / XSS defense |

---

## 1. Locations (`R-LOC-*`)

- **R-LOC-001**: Three locations exist: `tarragona`, `arrabassada`, `rincon`.
- **R-LOC-002**: Only `tarragona` and `arrabassada` accept online reservations and orders. `rincon` is informational only and must not appear in pickup-store selectors or reservation location dropdowns.
- **R-LOC-003**: Every location slug shown to a user (URL `?location=` or DB `location` column) must match one of the three known slugs. Invalid slugs are rejected with an error or fallback.
- **R-LOC-004**: `auto-assign-reservation` Edge Function rejects requests where `location` is not in `{tarragona, arrabassada, rincon}` with a 500 / `Invalid location` error.
- **R-LOC-005**: Reservations targeting `rincon` should be rejected at the application level even though the slug is allowed by the constraint, because Rincón has no tables seeded (see R-TBL-002).

## 2. Schedules (`R-SCH-*`)

Pizzeria opening hours apply to online reservations and the ASAP order flow.

- **R-SCH-001**: Tarragona opens **Wednesday through Monday, 19:00–23:30**. Closed all day Tuesday.
- **R-SCH-002**: Arrabassada opens **Tuesday through Sunday, 19:00–23:30**. Closed all day Monday.
- **R-SCH-003**: Rincón (info-only) opens Monday through Saturday, 08:00–22:00. Closed Sunday. Not enforced by `storeHours.ts`.
- **R-SCH-004**: `isStoreOpen(store, at)` returns true if `at` is within the store's open window AND not on its closed day.
- **R-SCH-005**: `getScheduleStatus(at)` returns `"open"` if at least one of Tarragona/Arrabassada is open at `at`, else `"before_hours"` with `opensAt` set to today 19:00, else `"after_hours"` with `opensAt` set to the next valid day at 19:00.
- **R-SCH-006**: `getAvailableDays(store?)` returns up to 7 future dates (starting today) where at least one candidate store opens.
- **R-SCH-007**: `getTimeSlots(day, store?)` returns slots from 19:00 to 23:00 in 30-minute increments. The 23:30 slot is excluded (last slot is 23:00 — too late to start a 90-min reservation before close).
- **R-SCH-008**: For *today*, `getTimeSlots` skips slots earlier than `now + 15 min` to give kitchen lead time.
- **R-SCH-009**: ASAP orders are blocked outside of store hours; only "scheduled for later" mode is allowed in that case.

## 3. Reservations — Public Flow (`R-RES-*`)

- **R-RES-001**: A guest (anonymous or authenticated) can submit a reservation via the public reservation form for `tarragona` or `arrabassada` only.
- **R-RES-002**: Required fields: `guest_name`, `phone`, `reservation_date`, `reservation_time`, `guests`, `location`. Email is hardcoded to `online@reserva.lozio` server-side; not collected in the form.
- **R-RES-003**: Online guest count must be **1 to 15** for non-admin callers (updated 2026-05-10). Groups marked as `15+` in the form must call the restaurant.
- **R-RES-004**: Admins (with `admin` role on the verified JWT) bypass the 1–10 limit and can book larger groups.
- **R-RES-005**: `user_id` on the resulting reservation row is derived from the verified JWT — never from the request body. Anonymous guests get `user_id = NULL`.
- **R-RES-006**: A reservation row is inserted with `status = 'confirmed'` after successful auto-assignment (note: the public REST INSERT policy only allows `status = 'pending'`; the `confirmed` status is set by the SECURITY DEFINER function `atomic_assign_and_reserve`).
- **R-RES-007**: After successful creation, a DB webhook fires push notifications to admin devices (see R-PUSH-001).
- **R-RES-008**: A guest cannot retrieve their own reservation after the confirmation page (no `mis-reservas` for guests; no anon SELECT policy on reservations).
- **R-RES-009**: An authenticated user can SELECT only reservations where `auth.uid() = user_id`.

## 4. Tables and Capacity (`R-TBL-*`)

These are seed-data assumptions. If the seed changes, tests must be updated.

- **R-TBL-001**: Tarragona has **0 tables** in the `tables` table. All Tarragona reservation attempts return `no_tables`.
- **R-TBL-002**: Rincón has **0 tables** in the `tables` table.
- **R-TBL-003**: Arrabassada has **12 tables** physically, but only **8 are exposed for online booking** — the 8 tables with capacity 6. Total seats bookable online: **48**.
  - The remaining 4 tables (1 of capacity 2 and 3 of capacity 4) are reserved as wildcards for staff to use for walk-ins or special seating; they are intentionally excluded from `find_available_tables_multi` by the `name IN ('Mesa 1'..'Mesa 8')` filter.
- **R-TBL-004**: The 8 bookable tables are named `Mesa 1`..`Mesa 8` and all have `is_active = true` and capacity 6. The SQL function `find_available_tables_multi` filters by name `IN ('Mesa 1'..'Mesa 8')`, which is correct given the wildcard convention.

## 5. Table Allocation Algorithm (`R-ALG-*`)

Implemented in `find_available_tables_multi` SQL function:

- **R-ALG-001**: For groups of **1–6 guests**, the function picks **a single table** with the *smallest capacity ≥ guests* (best-fit). Since all bookable tables in Arrabassada are capacity 6, every group of 1–6 gets a cap-6 table. (Updated 2026-05-10: the cap-2 and cap-4 tables are wildcards and not exposed to online booking — see R-TBL-003.)
- **R-ALG-002**: For groups of **7+ guests**, the function picks **multiple tables** by iterating `ORDER BY t.capacity DESC, t.name ASC` until total capacity ≥ guests. E.g., a group of 7 gets two cap-6 tables (12 seats). The largest online group is 15, requiring 3 cap-6 tables (18 seats).
- **R-ALG-003**: A reservation occupies its assigned tables for **90 minutes** starting at `reservation_time`. A new reservation at table T conflicts with an existing one if their 90-min windows overlap (i.e., `existing.start + 90 > new.start` AND `existing.start < new.start + 90`).
- **R-ALG-004**: Only reservations with `status IN ('pending', 'confirmed')` are counted as occupying a table. Cancelled / no-show reservations free the slot.
- **R-ALG-005**: If no combination of tables can fit the group at the requested slot, the function returns `NULL` and the Edge Function responds with `success: false, error: 'no_tables'`.

## 6. Reservation Concurrency (`R-CONCUR-*`)

- **R-CONCUR-001**: Two concurrent reservation attempts for the same `(location, date)` are serialized via `pg_advisory_xact_lock(hashtextextended(location || '|' || date::text, 0))` inside `atomic_assign_and_reserve`. They never assign the same table to two reservations.
- **R-CONCUR-002**: Under N concurrent attempts for the same slot, exactly `min(N, available_tables_for_party_size)` succeed; the rest receive `no_tables`.

## 7. Orders — Public Flow (`R-ORD-*`)

- **R-ORD-001**: A guest (anonymous or authenticated) can place an order with `order_type` of `pickup` or `delivery`.
- **R-ORD-002**: For pickup, `pickup_store` must be `tarragona` or `arrabassada`. Rincón is not selectable.
- **R-ORD-003**: For delivery, an address (street, city, postal code) is required. The system geo-computes the nearest open store at fulfillment time (`getNearestStore`) and assigns it to `assigned_to`.
- **R-ORD-004**: Required customer fields: `guest_name`, `guest_email`, `guest_phone`. These are validated client-side AND saved to the order row.
- **R-ORD-005**: An order row is inserted with `status = 'pending'`, `payment_status = 'pending'`, `stripe_session_id = NULL`. The public REST INSERT policy enforces these defaults.
- **R-ORD-006**: `user_id` on the order is `auth.uid()` for authenticated users, `NULL` for guests. The INSERT CHECK enforces `user_id IS NULL OR user_id = auth.uid()`.
- **R-ORD-007**: For Stripe orders, `assigned_to` is left `NULL` until payment confirms — this prevents the kitchen popup from firing on unpaid orders.
- **R-ORD-008**: For cash orders, `assigned_to` is set to the chosen pickup store (or geo-derived store for delivery) immediately, since payment happens at the store/door.
- **R-ORD-009**: After successful creation, the client navigates to `/pedido-confirmado?id=<orderId>` with the full order + items in router state. No DB read on the confirmation page for guests.
- **R-ORD-010**: A guest cannot retrieve their own order after the confirmation page (no `mis-pedidos` for guests; no anon SELECT policy on orders).

## 8. Order Items and Pricing (`R-ITEM-*`)

- **R-ITEM-001**: Each order has 1+ rows in `order_items` with `item_name`, `item_description` (may include extras), `quantity`, `unit_price`, `total_price`.
- **R-ITEM-002**: The `total_price` per item must equal `unit_price * quantity + sum(extras)`. Validated client-side; not re-validated by RLS.
- **R-ITEM-003**: The order's `total_amount` is the client-computed sum. **The Stripe Edge Function `create-payment-intent` recalculates this server-side from `order_items.total_price` — the client `total_amount` is never trusted for charging.**
- **R-ITEM-004**: Order items are inserted by the same authenticated session/anon JWT that created the parent order. The INSERT policy requires the parent order to exist, be `pending`, and either belong to the caller or be a guest order.

## 9. Cash Flow (`R-CASH-*`)

- **R-CASH-001**: When `payment_method = 'cash'`, the order is created with `payment_status = 'pending'`. The customer pays at pickup or to the delivery driver.
- **R-CASH-002**: Cash orders skip Stripe entirely. After insert, the client navigates straight to `/pedido-confirmado` with state.
- **R-CASH-003**: `payment_status` for cash orders is updated by admin/staff via the admin panel after physical payment, not by the customer.

## 10. Stripe Flow — Card Without Redirect (`R-STRIPE-A-*`)

For credit/debit cards using Stripe Elements without external redirect.

- **R-STRIPE-A-001**: After order INSERT, the client calls `create-payment-intent` Edge Function with `{ orderId, currency: 'eur' }`. The function reads `order_items` server-side, computes `amount = sum(total_price) * 100`, creates a Stripe PaymentIntent with `metadata: { orderId }`, and returns `{ clientSecret }`.
- **R-STRIPE-A-002**: The client uses Stripe Elements `confirmPayment` with `redirect: 'if_required'`. If 3DS or wallet is needed, Stripe handles it inline (popup iframe).
- **R-STRIPE-A-003**: When `paymentIntent.status === 'succeeded'`, the client calls `confirm-stripe-payment` Edge Function with `{ orderId, paymentIntentId }`. The function:
  - Retrieves the PaymentIntent from Stripe API.
  - Verifies `pi.metadata.orderId === orderId` (mismatch → 403).
  - Verifies `pi.status === 'succeeded'`.
  - Updates the order with service role: `payment_status = 'paid'`, `stripe_payment_intent_id`, `assigned_to`.
  - Returns the updated order + items.
- **R-STRIPE-A-004**: The client never updates `payment_status` directly. The over-permissive RLS policy that allowed this was removed (migration `20260510000001`).
- **R-STRIPE-A-005**: On Stripe failure, the order remains `payment_status = 'pending'`. No client-side UPDATE happens. The user can retry or abandon. Stale unpaid orders are admin-managed.

## 11. Stripe Flow — With External Redirect (`R-STRIPE-B-*`)

For Apple Pay, Google Pay, and some 3DS variations that require redirecting to the wallet/bank.

- **R-STRIPE-B-001**: `confirmPayment` is invoked with `return_url = ${origin}/pedido-confirmado?id=<orderId>`. After the user authorizes, Stripe redirects back to that URL with extra params: `payment_intent`, `redirect_status`, `payment_intent_client_secret`.
- **R-STRIPE-B-002**: On arrival at `/pedido-confirmado`, if `payment_intent` and `redirect_status === 'succeeded'` are present, the page calls `confirm-stripe-payment` (same function as R-STRIPE-A-003) and renders the returned order data.
- **R-STRIPE-B-003**: The Edge Function works for guests because it does not require a JWT (`verify_jwt = false`). Security comes from Stripe verification.
- **R-STRIPE-B-004**: If `redirect_status` is anything other than `succeeded` (e.g., `failed`, `requires_action`), the page does not call confirm-stripe-payment and shows an error / not-found state.

## 12. Order Status Lifecycle (`R-LIFE-*`)

- **R-LIFE-001**: Allowed `status` values: `pending`, `confirmed`, `preparing`, `ready`, `delivered`, `cancelled`. DB CHECK constraint enforces this.
- **R-LIFE-002**: Allowed `payment_status` values: `pending`, `paid`, `failed`, `refunded`. DB CHECK enforces.
- **R-LIFE-003**: New orders start at `status = 'pending'`. The IncomingOrderManager component on staff devices fires when a new pending order arrives for their assigned store.
- **R-LIFE-004**: Staff can transition `pending → confirmed → preparing → ready → delivered` for orders assigned to their store. Staff actions are gated by `pizzeriaTarragona` / `pizzeriaArrabassada` role.
- **R-LIFE-005**: Staff can transfer an order from one store to another (`assigned_to` change). The other store's IncomingOrderManager picks it up.
- **R-LIFE-006**: Cancellation triggers a refund if `payment_status = 'paid'` (Stripe-paid orders). Admin invokes `refund-order` Edge Function which uses Stripe Refund API + sets `payment_status = 'refunded'`.
- **R-LIFE-007**: Status changes that match `confirmed` or `cancelled` trigger an email to the customer via the DB webhook → `notify-order-status` → `send-transactional-email`.

## 13. Authentication (`R-AUTH-*`)

- **R-AUTH-001**: Email/password signup is enabled. Email confirmation is required (configured in Supabase Auth settings).
- **R-AUTH-002**: Auth tokens are persisted in `localStorage` via the Supabase client default. (Trade-off: vulnerable to XSS, mitigated by strict CSP — see R-INP-001.)
- **R-AUTH-003**: Login errors are mapped to translated messages in 4 languages. Generic messages, no enumeration.
- **R-AUTH-004**: Rate-limit responses (HTTP 429 from Supabase Auth) display "Too many attempts. Wait a few minutes." in the user's language.
- **R-AUTH-005**: Password reset flow: `/reset-password` (no token) → request link via email → user clicks link → `/reset-password?type=recovery&access_token=…` → set new password.
- **R-AUTH-006**: Auth signup must succeed for valid email + password ≥ 6 chars.
- **R-AUTH-007**: Auth signin must fail for wrong password with `errorInvalidCredentials` translation.

## 14. Profiles (`R-PROF-*`)

- **R-PROF-001**: A row is created in `public.profiles` automatically when a new auth user signs up (via `handle_new_user` trigger on `auth.users`).
- **R-PROF-002**: Editable fields: `full_name`, `phone`, `address`, `city`, `postal_code`, `allergies`, `food_preferences` (updated 2026-05-10: `favorite_table_area` removed from the form; the column persists in the schema for legacy data but is no longer user-editable).
- **R-PROF-003**: `internal_notes` is an admin-only field. The trigger `prevent_user_internal_notes_update` raises an exception if a non-admin tries to change it.
- **R-PROF-004**: Free-text fields (`full_name`, `address`, `food_preferences`, `internal_notes`) reject HTML / `javascript:` / `data:` patterns via `reject_html_input` trigger.
- **R-PROF-005**: A user can SELECT only their own profile. Admins can SELECT all profiles.
- **R-PROF-006**: A user can UPDATE only their own profile. Admins can UPDATE any profile.

## 15. Roles (`R-ROLE-*`)

- **R-ROLE-001**: `app_role` enum: `admin`, `user`, `pizzeriaTarragona`, `pizzeriaArrabassada`.
- **R-ROLE-002**: A user can have 0 or more roles. `user_roles` has `UNIQUE (user_id, role)`.
- **R-ROLE-003**: `has_role(uid, role)` is a `SECURITY DEFINER` function used in RLS policies. Returns boolean.
- **R-ROLE-004**: A user can SELECT only their own role rows. Admins can SELECT all roles.
- **R-ROLE-005**: Only admins can INSERT or DELETE rows in `user_roles`.
- **R-ROLE-006**: There is no UPDATE policy on `user_roles` — role changes happen via DELETE + INSERT.
- **R-ROLE-007**: `localStorage.lozio_is_admin` is a UI-only cache; it never affects server-side authorization.

## 16. Authorization — RLS Boundaries (`R-RLS-*`)

This section captures the contract for what each caller class can read/write. Each rule is testable by attempting the operation as the named role.

### `orders`
- **R-RLS-orders-001**: Anonymous users cannot SELECT any row (no anon SELECT policy).
- **R-RLS-orders-002**: Authenticated users can SELECT only rows where `user_id = auth.uid()`.
- **R-RLS-orders-003**: Pizzeria staff can SELECT rows where `assigned_to` matches their role's store.
- **R-RLS-orders-004**: Admins can SELECT all rows.
- **R-RLS-orders-005**: Anonymous and authenticated callers can INSERT rows that satisfy: `status = 'pending' AND payment_status = 'pending' AND stripe_session_id IS NULL AND (user_id IS NULL OR user_id = auth.uid())`. Any deviation raises a policy violation.
- **R-RLS-orders-006**: Only admins and pizzeria staff can UPDATE rows. The client UPDATE for `payment_status = 'paid'` (the historical bypass) is removed; only Edge Functions with service role can do that.
- **R-RLS-orders-007**: No DELETE policy exists. DELETEs are blocked for everyone except service role.

### `order_items`
- **R-RLS-items-001**: Anonymous users cannot SELECT any row.
- **R-RLS-items-002**: Authenticated users can SELECT items only for orders they own.
- **R-RLS-items-003**: Pizzeria staff can SELECT items for orders assigned to their store.
- **R-RLS-items-004**: Admins can SELECT all items.
- **R-RLS-items-005**: Anonymous and authenticated callers can INSERT items only for orders that are `pending` AND owned by them (or `user_id IS NULL`).

### `reservations`
- **R-RLS-res-001**: Anonymous users cannot SELECT any row.
- **R-RLS-res-002**: Authenticated users can SELECT only their own reservations.
- **R-RLS-res-003**: Admins can SELECT all reservations.
- **R-RLS-res-004**: Anonymous and authenticated INSERT must satisfy `status = 'pending' AND location IN ('tarragona','arrabassada','rincon')`. The Edge Function `auto-assign-reservation` uses service role and bypasses this — it inserts with `status = 'confirmed'`.
- **R-RLS-res-005**: A user can UPDATE only their own reservations. Admins can UPDATE any.
- **R-RLS-res-006**: No DELETE policy exists.

### `profiles`
- **R-RLS-prof-001**: Anonymous users cannot SELECT or UPDATE.
- **R-RLS-prof-002**: An authenticated user can SELECT/UPDATE only their own row.
- **R-RLS-prof-003**: Admins can SELECT/UPDATE any row.

### `user_roles`
- **R-RLS-role-001**: A user can SELECT only their own role rows.
- **R-RLS-role-002**: Admins can SELECT all rows; INSERT and DELETE roles.

### `tables`
- **R-RLS-tbl-001**: Anonymous and authenticated callers can SELECT rows where `is_active = true` (needed to render reservation availability).
- **R-RLS-tbl-002**: Only admins can INSERT/UPDATE/DELETE.

### `media`
- **R-RLS-med-001**: Anyone can SELECT. Only admins can INSERT/UPDATE/DELETE.
- **R-RLS-med-002**: The `media` storage bucket has `allowed_mime_types` restricted to images + video formats. Non-media uploads are rejected at the storage layer.

### `push_subscriptions`
- **R-RLS-push-001**: A user can only SELECT/INSERT/UPDATE/DELETE their own subscriptions.

### `reviews`
- **R-RLS-rev-001**: Anyone can SELECT and INSERT. No UPDATE or DELETE policies (reviews are append-only). Submissions go through `reject_html_input` trigger.

### `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`
- **R-RLS-email-001**: Service role only. No public access.

### `menu_items`
- **R-RLS-menu-001**: Anyone can SELECT rows where `is_active = true`. Only admins can SELECT all (for the admin panel) and modify.

### `site_settings`
- **R-RLS-set-001**: Anyone can SELECT (reads only public flags like `reservations_enabled`). Only admins can modify.

## 17. Edge Function Authorization (`R-EDGE-*`)

- **R-EDGE-001**: `refund-order` requires admin JWT. Returns 401 without auth, 403 for non-admin.
- **R-EDGE-002**: `confirm-reservation` requires admin JWT. Same response behavior.
- **R-EDGE-003**: `auto-assign-reservation` accepts anon JWT (guest reservations are allowed). Admin status is derived from JWT, never request body. `user_id` is derived from JWT, never request body.
- **R-EDGE-004**: `send-push-notification` accepts no auth on the DB-webhook path. The `test: true` path requires admin JWT and only sends to the requesting admin's own subscription.
- **R-EDGE-005**: `create-payment-intent` accepts authenticated callers (default `verify_jwt = true`). Calculates amount from DB, never trusts client.
- **R-EDGE-006**: `confirm-stripe-payment` accepts no JWT. Security comes from verifying the PaymentIntent with Stripe API and matching `metadata.orderId`.
- **R-EDGE-007**: `notify-order-status` accepts no JWT (DB webhook). Returns generic error messages; never leaks `error.message`.
- **R-EDGE-008**: `send-transactional-email` requires one of: `service_role` JWT, staff role (admin/pizzeria*), or authenticated user whose email matches the recipient. Anything else returns 403.
- **R-EDGE-009**: `process-email-queue` requires service-role JWT (verified via claims). Forbidden for other roles.
- **R-EDGE-010**: `preview-transactional-email` requires the `LOVABLE_API_KEY` as Bearer token.
- **R-EDGE-011**: `handle-email-unsubscribe` accepts a single-use token in URL or body. Rejects invalid/expired tokens with 404.
- **R-EDGE-012**: `handle-email-suppression` requires a valid HMAC signature from Lovable's webhook library.
- **R-EDGE-013**: All Edge Functions return generic error messages (no `error.message` leak). Internal details are logged server-side only.

## 18. Admin Panel (`R-ADM-*`)

- **R-ADM-001**: `/admin` route requires `admin` role. Non-admins are redirected to `/`.
- **R-ADM-002**: Admin tabs: reservations calendar, floor plan, products, customers, reviews, media, reports, user roles.
- **R-ADM-003**: Admin can grant/revoke `admin`, `pizzeriaTarragona`, `pizzeriaArrabassada` roles via the user-roles tab.
- **R-ADM-004**: Admin can edit `internal_notes` on any profile (admin-only field).
- **R-ADM-005**: Admin can mark orders as confirmed/cancelled and trigger refunds.
- **R-ADM-006**: `/admin/pedidos/<store>` shows orders for that store. Accessible to admin and the matching pizzeria role.

## 19. Staff Panel — Incoming Orders (`R-STAFF-*`)

- **R-STAFF-001**: Pizzeria staff (with role `pizzeriaTarragona` or `pizzeriaArrabassada`) see a popup (`IncomingOrderManager`) when a new pending order is assigned to their store via Supabase Realtime.
- **R-STAFF-002**: Staff can accept (set `status = 'confirmed'`, set `estimated_time`), transfer (change `assigned_to`), or reject (set `status = 'cancelled'`).
- **R-STAFF-003**: Accepting an order triggers an order-status email to the customer.
- **R-STAFF-004**: Rejecting an order triggers a cancellation email.
- **R-STAFF-005**: The customer's `tel:` link in the staff popup is rendered with phone-number validation; only digits, plus, spaces, dashes, parentheses are allowed.

## 20. Reviews (`R-REV-*`)

- **R-REV-001**: Anyone can submit a review with `name`, `rating` (1–5), `message`, `category`.
- **R-REV-002**: Allowed categories: `food`, `service`, `ambiance`, `value`, `overall`. DB CHECK enforces.
- **R-REV-003**: Reviews containing HTML or `javascript:` / `data:` URI schemes are rejected at insert by `reject_html_input` trigger.
- **R-REV-004**: Reviews are publicly readable. Cannot be edited or deleted by users.

## 21. Email Infrastructure (`R-EMAIL-*`)

- **R-EMAIL-001**: Order-status changes (to `confirmed` or `cancelled`) fire a DB webhook → `notify-order-status` → enqueue an email via `send-transactional-email`.
- **R-EMAIL-002**: Emails are queued in pgmq queues `auth_emails` (priority) and `transactional_emails`. A pg_cron job runs `process-email-queue` every 5 seconds.
- **R-EMAIL-003**: Recipients on the `suppressed_emails` table are not sent. Returning a `success: false, reason: 'email_suppressed'` is non-fatal.
- **R-EMAIL-004**: Each transactional email includes an unsubscribe link with a single-use token (RFC 8058 compatible).
- **R-EMAIL-005**: Bounces, complaints, and unsubscribes are written to `suppressed_emails` via the `handle-email-suppression` webhook.
- **R-EMAIL-006**: Duplicate sends are prevented by a unique partial index on `email_send_log(message_id) WHERE status = 'sent'`.

## 22. Push Notifications (`R-PUSH-*`)

- **R-PUSH-001**: Admins enable push by visiting their profile/settings and clicking "Enable notifications". The browser registers a subscription, stored in `push_subscriptions` keyed by `user_id` and `endpoint` (unique).
- **R-PUSH-002**: A new reservation INSERT fires a DB webhook → `send-push-notification` → web-push to all admin subscriptions.
- **R-PUSH-003**: A `test: true` payload with admin JWT sends a test push only to the requesting admin's first subscription.
- **R-PUSH-004**: Subscriptions returning HTTP 410 GONE are auto-deleted.

## 23. PWA / Service Worker (`R-PWA-*`)

- **R-PWA-001**: The app can be installed on supported devices via the InstallBanner.
- **R-PWA-002**: When a new SW version is available, the UpdateBanner prompts the user to reload.
- **R-PWA-003**: Workbox precaches build assets (≤ 5 MB per file). Runtime navigation is network-first with a cache fallback.

## 24. i18n (`R-I18N-*`)

- **R-I18N-001**: Languages supported: `es`, `en`, `ca`, `it`. Default `es`.
- **R-I18N-002**: Initial language is detected from `localStorage` first, then `navigator.language`.
- **R-I18N-003**: All user-visible strings (errors, buttons, labels) come from translation keys in `src/i18n/locales/{lang}.json`. No hardcoded user-facing copy in components.

## 25. Input Validation and XSS Defense (`R-INP-*`)

- **R-INP-001**: A strict CSP is set in `index.html`: `script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline'; ...`. No external scripts beyond Stripe.
- **R-INP-002**: All free-text columns subject to user input (`orders.notes`, `orders.guest_name`, `orders.delivery_address`, `orders.guest_phone`, `reservations.guest_name`, `reservations.notes`, `reservations.phone`, `reviews.message`, `profiles.full_name`, `profiles.address`, `profiles.food_preferences`, `profiles.internal_notes`) reject patterns matching `<[a-zA-Z/!]|javascript:|data:[a-zA-Z]` at INSERT/UPDATE via `reject_html_input` trigger.
- **R-INP-003**: Phone numbers in `tel:` href are validated client-side with regex `/^[+\d\s\-().]{1,20}$/`. Failed validation falls back to `href="#"`.
- **R-INP-004**: `media.file_path` rejects `../`, absolute paths, and disallowed characters via DB CHECK constraint.
- **R-INP-005**: Enum-typed columns (`status`, `payment_status`, `order_type`, `payment_method`, `location`, `category`) have DB CHECK constraints — direct REST API cannot insert arbitrary values.
- **R-INP-006**: Server-side sanitization is the source of truth. Client-side validation is UX only.

## 26. Stripe Server-Side (`R-STRIPE-S-*`)

- **R-STRIPE-S-001**: `create-payment-intent` recalculates `amount` server-side from `order_items.total_price`. Client `total_amount` is never used for charging.
- **R-STRIPE-S-002**: `confirm-stripe-payment` retrieves the PaymentIntent from Stripe API and verifies `metadata.orderId === orderId` before marking as paid.
- **R-STRIPE-S-003**: A failed Stripe verification (status mismatch, metadata mismatch) does not modify the order — caller receives 403.
- **R-STRIPE-S-004**: Refunds go through `refund-order` Edge Function which calls Stripe Refund API and updates `payment_status = 'refunded'`.

---

## Test Strategy

Each rule maps to one or more of these test layers:

| Layer | Tool | Covers |
|---|---|---|
| **Unit** | Vitest | Pure functions: `storeHours.ts`, `availability.ts`, allergens, locations, regex validators |
| **Component** | Vitest + RTL | Form validation, state transitions in components |
| **DB** | Supabase SQL Editor / `psql` | RLS policies, triggers, CHECK constraints |
| **Edge Function** | bash + curl (`scripts/test-*.sh`) | Auth model, error sanitization, response shape |
| **Race / concurrency** | Parallel curl | `R-CONCUR-*`, `R-RES-*` race scenarios |
| **E2E** | Playwright | Full user flows (signup → reserve → see, guest checkout → see, admin actions) |

Coverage matrix (which test layer covers each domain):

| Domain | Unit | Comp | DB | Edge | Race | E2E |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Schedules (R-SCH) | ● | ● | | | | |
| Reservations (R-RES, R-TBL, R-ALG) | ● | ● | ● | ● | ● | ● |
| Concurrency (R-CONCUR) | | | ● | | ● | |
| Orders (R-ORD, R-ITEM) | ● | ● | ● | ● | | ● |
| Stripe (R-STRIPE-A/B/S) | | ● | | ● | | ● |
| Auth (R-AUTH) | | ● | | | | ● |
| Profiles (R-PROF) | | ● | ● | | | ● |
| Roles & RLS (R-ROLE, R-RLS) | | | ● | ● | | |
| Edge Functions (R-EDGE) | | | | ● | | |
| Admin (R-ADM, R-STAFF) | | ● | | | | ● |
| Reviews (R-REV) | | ● | ● | | | |
| Email (R-EMAIL) | | | ● | ● | | |
| Push (R-PUSH) | | | | ● | | |
| PWA (R-PWA) | | | | | | ● |
| i18n (R-I18N) | ● | ● | | | | |
| Input validation (R-INP) | ● | | ● | | | |

---

## Resolved questions / known issues

User-resolved on 2026-05-10:

- **Q1 (R-TBL):** ✅ Confirmed: 12 tables physical, 8 bookable online, 4 wildcards. R-TBL-003 / R-TBL-004 updated.
- **Q2 (R-RES-005):** ✅ Confirmed: a guest who is mid-flow choosing a time can sign in first to attribute the reservation to their account.
- **Q3 (R-CASH-003):** Pending: user is still deciding the right action for staff to mark cash orders as paid.
- **Q4 (R-PUSH-001):** ✅ Confirmed: opt-in lives in `/admin`.
- **Q5 (R-EMAIL-002):** ✅ Confirmed: `process-email-queue` cron job is active.

## Known bugs / things to verify next

- **B1 — Cancellation email not arriving (2026-05-10).** When an order is cancelled, the customer email does not arrive. Two senders are involved: (1) `IncomingOrderManager.handleReject` calls `send-transactional-email` directly from the staff client, and (2) the DB webhook on `orders` UPDATE fires `notify-order-status` which also enqueues an email. To diagnose:
  1. Note the order's `id`. In the SQL editor, run:
     ```sql
     SELECT * FROM public.email_send_log WHERE message_id LIKE '%' OR recipient_email = '<test_email>' ORDER BY created_at DESC LIMIT 20;
     ```
     Look for an entry with `template_name='order-status-update'`, `status` (`pending`/`sent`/`failed`/`suppressed`/`bounced`).
  2. Check if the recipient email is in `suppressed_emails` (gets blocked):
     ```sql
     SELECT * FROM public.suppressed_emails WHERE email = '<test_email>';
     ```
  3. Check Edge Function logs for `notify-order-status` and `send-transactional-email` in Supabase dashboard around the cancellation timestamp.
  4. Verify the DB webhook is configured: Supabase Dashboard → Database → Webhooks → look for one targeting `public.orders` on UPDATE that calls the `notify-order-status` Edge Function.

- **B2 — `site_settings` 406 error (2026-05-10).** Querying `?key=eq.reservations_enabled` returns HTTP 406 — likely the row does not exist in this project. Cosmetic, not a security issue, but the app should handle the missing row gracefully (treat as enabled by default).

---

## Maintenance

- When a rule is **modified**, update its body and append `(updated YYYY-MM-DD)` after the rule ID.
- When a rule is **deprecated/removed**, do NOT renumber. Mark as `~~R-XXX-NNN~~ (removed YYYY-MM-DD)` and explain why. New rules get the next free number.
- When you find a bug that contradicts a rule, file an issue referencing the rule ID.
