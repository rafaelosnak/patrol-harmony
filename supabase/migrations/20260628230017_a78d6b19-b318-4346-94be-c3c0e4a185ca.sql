
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS default_round_mode text NOT NULL DEFAULT 'checkpoints' CHECK (default_round_mode IN ('checkpoints','track'));
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'checkpoints' CHECK (mode IN ('checkpoints','track'));
