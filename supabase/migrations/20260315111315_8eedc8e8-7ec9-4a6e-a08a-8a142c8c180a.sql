
-- Create tables table for floor plan
CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 4,
  position_x numeric NOT NULL DEFAULT 0,
  position_y numeric NOT NULL DEFAULT 0,
  shape text NOT NULL DEFAULT 'square',
  is_active boolean NOT NULL DEFAULT true,
  location text NOT NULL DEFAULT 'tarragona',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add table_id to reservations
ALTER TABLE public.reservations ADD COLUMN table_id uuid REFERENCES public.tables(id);

-- Enable RLS on tables
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with tables
CREATE POLICY "Admins can view tables" ON public.tables FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert tables" ON public.tables FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update tables" ON public.tables FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete tables" ON public.tables FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view tables (for reservation flow)
CREATE POLICY "Anyone can view active tables" ON public.tables FOR SELECT TO anon USING (is_active = true);

-- Enable realtime for reservations
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
