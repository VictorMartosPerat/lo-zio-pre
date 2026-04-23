
-- Create menu_items table
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  category text NOT NULL,
  allergens text[] DEFAULT '{}',
  badge_key text,
  badge_emoji text,
  badge_style text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Public can read active items
CREATE POLICY "Anyone can view active menu items"
  ON public.menu_items FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- No INSERT/UPDATE/DELETE policies for regular users — only service_role bypasses RLS

-- Insert Pizzas
INSERT INTO public.menu_items (name, price, category, allergens, sort_order) VALUES
  ('MARINARA', 9.50, 'pizzas', '{gluten,lacteos}', 1),
  ('MARGHERITA', 10.00, 'pizzas', '{gluten,lacteos}', 2),
  ('SICILIANA', 11.00, 'pizzas', '{gluten,lacteos,pescado}', 3),
  ('FUNGHI', 11.00, 'pizzas', '{gluten,lacteos}', 4),
  ('GRECA', 11.00, 'pizzas', '{gluten,lacteos}', 5),
  ('TEDESCA', 11.00, 'pizzas', '{gluten,lacteos,soja,mostaza,sulfitos}', 6),
  ('PICCANTE', 11.00, 'pizzas', '{gluten,lacteos,mostaza,sulfitos}', 7),
  ('TARRAGONINA', 11.00, 'pizzas', '{gluten,lacteos,huevo,sulfitos}', 8),
  ('PROSCIUTTO', 11.00, 'pizzas', '{gluten,lacteos,sulfitos}', 9),
  ('RÚSTICA', 11.00, 'pizzas', '{gluten,lacteos,sulfitos}', 10),
  ('CALABRESE', 11.00, 'pizzas', '{gluten,lacteos,sulfitos}', 11),
  ('TONNARA', 11.00, 'pizzas', '{gluten,lacteos,pescado}', 12),
  ('CATALANA', 11.00, 'pizzas', '{gluten,lacteos,huevo,sulfitos}', 13),
  ('VEGETARIANA', 11.00, 'pizzas', '{gluten,lacteos}', 14),
  ('4 STAGIONI', 12.00, 'pizzas', '{gluten,lacteos,sulfitos}', 15),
  ('MILANO', 12.00, 'pizzas', '{gluten,lacteos,sulfitos}', 16),
  ('TROPEA', 13.00, 'pizzas', '{gluten,lacteos}', 17),
  ('HAWAI', 13.00, 'pizzas', '{gluten,lacteos,sulfitos}', 18);

INSERT INTO public.menu_items (name, price, category, allergens, badge_key, badge_emoji, badge_style, sort_order) VALUES
  ('BOSCAIOLA', 13.50, 'pizzas', '{gluten,lacteos,sulfitos}', 'badgeTeal', '⭐', 'teal', 19),
  ('4 FORMAGGI', 13.50, 'pizzas', '{gluten,lacteos}', NULL, NULL, NULL, 20),
  ('ITALIANA', 14.00, 'pizzas', '{gluten,lacteos}', 'badgeGold', '🏛️', 'gold', 21),
  ('SPECK', 14.00, 'pizzas', '{gluten,lacteos,sulfitos}', NULL, NULL, NULL, 22),
  ('BRESAOLINA', 14.00, 'pizzas', '{gluten,lacteos,sulfitos}', NULL, NULL, NULL, 23),
  ('CIOCIARA', 15.00, 'pizzas', '{gluten,lacteos,sulfitos}', NULL, NULL, NULL, 24),
  ('SALENTINA', 15.50, 'pizzas', '{gluten,lacteos}', NULL, NULL, NULL, 25),
  ('FANTASÍA', 16.00, 'pizzas', '{gluten,lacteos}', NULL, NULL, NULL, 26),
  ('LOMBARDA', 16.00, 'pizzas', '{gluten,lacteos,sulfitos}', NULL, NULL, NULL, 27),
  ('NORVEGIA', 18.50, 'pizzas', '{gluten,lacteos,pescado,sulfitos}', NULL, NULL, NULL, 28);

-- Insert Focaccias
INSERT INTO public.menu_items (name, price, category, allergens, sort_order) VALUES
  ('FOCACCIA CRUDO', 11.50, 'focaccias', '{gluten,sulfitos}', 1),
  ('FOCACCIA CAPRESE', 11.50, 'focaccias', '{gluten,lacteos}', 2);

INSERT INTO public.menu_items (name, price, category, allergens, badge_key, badge_emoji, badge_style, sort_order) VALUES
  ('LA FOCACCIA DELLO ZIO', 15.00, 'focaccias', '{gluten,lacteos,sulfitos}', 'badgeFire', '🌶️', 'fire', 3);

-- Insert Calzones
INSERT INTO public.menu_items (name, price, category, allergens, sort_order) VALUES
  ('CALZONE', 11.00, 'calzones', '{gluten,lacteos,sulfitos}', 1),
  ('BIG CALZONE', 14.00, 'calzones', '{gluten,lacteos,huevo,sulfitos}', 2),
  ('RUSTICELLA (Calzone)', 15.00, 'calzones', '{gluten,lacteos,sulfitos}', 3);

-- Insert Drinks
INSERT INTO public.menu_items (name, price, category, sort_order) VALUES
  ('Cerveza', 3.00, 'drinks', 1),
  ('Refresco', 2.50, 'drinks', 2),
  ('Botella de vino', 20.00, 'drinks', 3),
  ('Agua', 2.50, 'drinks', 4);

-- Insert Extras
INSERT INTO public.menu_items (name, price, category, sort_order) VALUES
  ('Extra: Verdura', 2.00, 'extras', 1),
  ('Extra: Embutido / Queso', 3.00, 'extras', 2),
  ('Extra: Mozzarella búfala', 5.00, 'extras', 3);

-- Insert Desserts
INSERT INTO public.menu_items (name, price, category, sort_order) VALUES
  ('Tiramisú', 6.00, 'desserts', 1);
