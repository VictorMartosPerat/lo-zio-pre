
-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create reservations table
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location text NOT NULL,
  guest_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  guests text NOT NULL DEFAULT '2',
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Anyone can insert reservations (public facing)
CREATE POLICY "Anyone can create reservations"
  ON public.reservations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own reservations
CREATE POLICY "Users can view own reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all reservations
CREATE POLICY "Admins can view all reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update reservations (e.g. change status)
CREATE POLICY "Admins can update reservations"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
