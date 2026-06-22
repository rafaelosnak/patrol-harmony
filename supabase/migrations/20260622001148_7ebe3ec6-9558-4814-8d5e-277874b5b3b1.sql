
DO $$ BEGIN
  CREATE TYPE public.company_plan AS ENUM ('starter','pro','business','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan public.company_plan NOT NULL DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS max_users integer NOT NULL DEFAULT 15;

CREATE OR REPLACE FUNCTION public.company_user_count(_company_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.profiles WHERE company_id = _company_id
$$;

CREATE OR REPLACE FUNCTION public.company_can_add_user(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT plan FROM public.companies WHERE id = _company_id) = 'enterprise' THEN true
    ELSE (SELECT COUNT(*) FROM public.profiles WHERE company_id = _company_id)
         < COALESCE((SELECT max_users FROM public.companies WHERE id = _company_id), 0)
  END
$$;

REVOKE EXECUTE ON FUNCTION public.company_user_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_can_add_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_user_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.company_can_add_user(uuid) TO authenticated, service_role;
