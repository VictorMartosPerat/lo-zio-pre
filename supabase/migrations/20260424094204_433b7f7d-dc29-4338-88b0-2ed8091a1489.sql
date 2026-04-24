-- 1. Grant admin role to the requested user
INSERT INTO public.user_roles (user_id, role)
VALUES ('610b2fc6-cc95-42eb-95cd-2070716932ec', 'admin')
ON CONFLICT DO NOTHING;

-- 2. Allow admins to manage user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Helper function: list users with email + roles (admin only)
CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  roles app_role[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    p.full_name,
    u.created_at,
    COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::app_role[]) AS roles
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  GROUP BY u.id, u.email, p.full_name, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;