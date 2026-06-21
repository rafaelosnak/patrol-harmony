
CREATE POLICY "user_roles_staff_read" ON public.user_roles FOR SELECT TO authenticated
USING (public.is_supervisor_or_admin(auth.uid()));
