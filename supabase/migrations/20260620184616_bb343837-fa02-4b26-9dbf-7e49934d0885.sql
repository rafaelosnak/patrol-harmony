
-- Time clock entries (ponto) for vigias
CREATE TYPE public.punch_type AS ENUM ('entrada', 'almoco_saida', 'almoco_volta', 'saida');

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  punch_type public.punch_type NOT NULL,
  punched_at timestamptz NOT NULL DEFAULT now(),
  latitude numeric,
  longitude numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX time_entries_user_day_idx ON public.time_entries (user_id, punched_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Helper: supervisor or admin (used across policies / app)
CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','supervisor')
  )
$$;

CREATE POLICY "own_select_time_entries" ON public.time_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_supervisor_or_admin(auth.uid()));

CREATE POLICY "own_insert_time_entries" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin_delete_time_entries" ON public.time_entries
  FOR DELETE TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));

-- Allow admin/supervisor to view all profiles and manage user_roles
CREATE POLICY "staff_view_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));

CREATE POLICY "admin_manage_user_roles_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_manage_user_roles_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_manage_user_roles_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
