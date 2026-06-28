
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_shift_type text,
  ADD COLUMN IF NOT EXISTS work_period text;
