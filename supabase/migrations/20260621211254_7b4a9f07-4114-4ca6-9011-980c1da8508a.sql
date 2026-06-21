-- Add photo support to checkpoints
ALTER TABLE public.round_checkpoints
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS checkpoint_location_id uuid;

-- Predefined checkpoint locations (admins/supervisors manage)
CREATE TABLE IF NOT EXISTS public.checkpoint_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoint_locations TO authenticated;
GRANT ALL ON public.checkpoint_locations TO service_role;

ALTER TABLE public.checkpoint_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read checkpoint locations"
  ON public.checkpoint_locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/supervisors manage checkpoint locations"
  ON public.checkpoint_locations FOR ALL TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()))
  WITH CHECK (public.is_supervisor_or_admin(auth.uid()));

CREATE TRIGGER trg_checkpoint_locations_updated_at
  BEFORE UPDATE ON public.checkpoint_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.round_checkpoints
  ADD CONSTRAINT round_checkpoints_location_fk
  FOREIGN KEY (checkpoint_location_id) REFERENCES public.checkpoint_locations(id) ON DELETE SET NULL;
