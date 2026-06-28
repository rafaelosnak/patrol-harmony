
ALTER TABLE public.checkpoint_locations
  ADD COLUMN IF NOT EXISTS radius_meters integer NOT NULL DEFAULT 80;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS geofence_radius_meters integer NOT NULL DEFAULT 150;

ALTER TABLE public.round_checkpoints
  ADD COLUMN IF NOT EXISTS outside_geofence boolean,
  ADD COLUMN IF NOT EXISTS distance_from_target_m double precision;
