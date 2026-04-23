-- Allow admins full CRUD on menu_items
CREATE POLICY "Admins can view all menu items"
ON public.menu_items
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert menu items"
ON public.menu_items
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update menu items"
ON public.menu_items
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete menu items"
ON public.menu_items
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));