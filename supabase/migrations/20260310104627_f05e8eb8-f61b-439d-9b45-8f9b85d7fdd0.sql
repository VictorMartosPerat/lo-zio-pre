
-- Orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text NOT NULL,
  order_type text NOT NULL DEFAULT 'pickup' CHECK (order_type IN ('pickup', 'delivery')),
  delivery_address text,
  delivery_city text,
  delivery_postal_code text,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'stripe')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  stripe_session_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  notes text,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  item_name text NOT NULL,
  item_description text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Anyone can create orders (guest ordering)
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admins can view and update all orders
CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Order items viewable with order access
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND has_role(auth.uid(), 'admin'::app_role)));
