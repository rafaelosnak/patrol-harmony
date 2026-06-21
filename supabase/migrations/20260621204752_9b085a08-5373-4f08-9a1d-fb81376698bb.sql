-- Checkpoints registered during a round (with geolocation)
CREATE TABLE public.round_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  lat double precision,
  lng double precision,
  accuracy double precision,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_checkpoints TO authenticated;
GRANT ALL ON public.round_checkpoints TO service_role;

ALTER TABLE public.round_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkpoints_read_authed" ON public.round_checkpoints
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "checkpoints_self_insert" ON public.round_checkpoints
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "checkpoints_self_or_staff_update" ON public.round_checkpoints
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "checkpoints_staff_delete" ON public.round_checkpoints
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );

CREATE INDEX idx_round_checkpoints_round ON public.round_checkpoints(round_id);

-- Auto-increment checkpoints_done on the parent round when a checkpoint is inserted
CREATE OR REPLACE FUNCTION public.bump_round_checkpoints_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rounds
     SET checkpoints_done = checkpoints_done + 1
   WHERE id = NEW.round_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_round_checkpoints
AFTER INSERT ON public.round_checkpoints
FOR EACH ROW EXECUTE FUNCTION public.bump_round_checkpoints_done();