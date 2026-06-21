
CREATE POLICY admin_update_time_entries ON public.time_entries
  FOR UPDATE TO authenticated
  USING (is_supervisor_or_admin(auth.uid()))
  WITH CHECK (is_supervisor_or_admin(auth.uid()));
