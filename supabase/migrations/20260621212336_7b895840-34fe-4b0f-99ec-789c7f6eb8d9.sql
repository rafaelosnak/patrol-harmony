-- Allow admins/supervisors to delete rounds
CREATE POLICY "Admins/supervisors delete rounds"
  ON public.rounds FOR DELETE TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));

-- Repoint alerts.user_id FK to profiles so PostgREST embeds work
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
