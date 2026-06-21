
-- Allow all authenticated users to update alerts (status, message) and round checkpoints (label/notes)
DROP POLICY IF EXISTS alerts_update_staff ON public.alerts;
CREATE POLICY alerts_update_authed ON public.alerts
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS checkpoints_self_or_staff_update ON public.round_checkpoints;
CREATE POLICY checkpoints_update_authed ON public.round_checkpoints
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
