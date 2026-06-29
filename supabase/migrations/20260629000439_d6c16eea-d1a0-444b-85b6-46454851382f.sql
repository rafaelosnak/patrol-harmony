ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS reference_track jsonb,
  ADD COLUMN IF NOT EXISTS reference_track_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS reference_track_set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;