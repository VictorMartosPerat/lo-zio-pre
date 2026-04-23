CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'restaurant',
  rating integer NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert reviews" ON public.reviews
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read reviews" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (true);