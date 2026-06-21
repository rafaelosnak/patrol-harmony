
-- Add 'central' role to app_role enum (for central/dispatcher support users)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'central';

-- Add phone/whatsapp contact column on units
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS phone text;
