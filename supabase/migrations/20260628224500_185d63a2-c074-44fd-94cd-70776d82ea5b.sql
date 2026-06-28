
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS shift_a_start time DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS shift_a_end   time DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS shift_b_start time DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS shift_b_end   time DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS shift_c_start time DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS shift_c_end   time DEFAULT '06:00';
