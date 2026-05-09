# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Keeping this file up to date

Before starting any significant change (new feature, refactor, new dependency, routing change, schema migration), update this file first to reflect the intended architecture. Keep it accurate as the codebase evolves.

## Security

For security reviews, attack surface analysis, RLS audits, and Edge Function authorization checks, refer to [`SKILLS.md`](./SKILLS.md). It contains the cybersecurity agent's full context for this architecture — known risks, existing protections, remediation patterns, and a per-change security review workflow.

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

### Cart

`CartContext` (`src/contexts/CartContext.tsx`) persists cart state to `localStorage` (`lozio_cart`). Cart items support extras (`CartItemExtra`) and per-item notes. The drawer (`CartDrawer`) and floating button are rendered globally.

### Supabase integration

- Client: `src/integrations/supabase/client.ts`
- Types auto-generated: `src/integrations/supabase/types.ts` — **do not hand-edit**, regenerate with `supabase gen types typescript`.
- Edge Functions live in `supabase/functions/`: `create-payment-intent`, `notify-order-status`, `refund-order`, `send-push-notification`, `auto-assign-reservation`, `confirm-reservation`.
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
