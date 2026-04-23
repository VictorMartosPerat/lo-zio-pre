
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can update settings" ON public.site_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert settings" ON public.site_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.site_settings (key, value) VALUES ('reservations_enabled', 'true'::jsonb);
