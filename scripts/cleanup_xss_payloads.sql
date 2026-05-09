-- One-off cleanup: remove XSS payloads injected during the security audit (Pache.pdf).
-- Run this ONCE in the Supabase SQL editor against the PRE project.
-- After running, verify rows are either updated or deleted as appropriate.

-- Orders injected during audit
DELETE FROM public.orders WHERE id IN (
  '218c36c9-416a-465b-9fb0-1bbab7b35b5e',
  '7b43e86b-e7ca-4dc2-8b7a-16a811685f77',
  'b09435ce-9dca-4169-9369-634db3517932'
);

-- Reservations injected during audit
DELETE FROM public.reservations WHERE id IN (
  '8191bb2b-3b5f-4648-bc8a-53add8c28838',
  '4fb10f36-8ca7-4f63-8f96-57f419927a75',
  '83496b20-0039-4047-b829-6280da487108'
);

-- Reviews injected during audit
DELETE FROM public.reviews WHERE id IN (
  'cc40f364-1b11-4fd7-a2e8-2054df066a41',
  'b4732f56-cd63-4967-8657-e992f1eccaa4'
);

-- Profile updated with XSS payloads — sanitize fields, keep the account
UPDATE public.profiles
SET
  full_name        = NULL,
  address          = NULL,
  food_preferences = NULL
WHERE id = '10a97dc2-6e0b-499f-bc62-b9541f9bb625';
