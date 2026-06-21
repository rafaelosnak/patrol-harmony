
-- 1) companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  contact_email text,
  contact_phone text,
  address text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','overdue')),
  monthly_fee numeric(10,2) NOT NULL DEFAULT 0,
  billing_day smallint NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  due_date date,
  last_payment_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.companies (id, name, status, monthly_fee)
VALUES ('00000000-0000-0000-0000-000000000001', 'Empresa Padrão', 'active', 0);

-- 2) Add company_id to all tenant tables FIRST (so functions can reference it)
ALTER TABLE public.profiles             ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles           ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.clients              ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.rounds               ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.round_checkpoints    ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.checkpoint_locations ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.occurrences          ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.alerts               ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.shifts               ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.time_entries         ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.vehicles             ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.announcements        ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.messages             ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Backfill
UPDATE public.profiles             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.user_roles           SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.clients              SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.rounds               SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.round_checkpoints    SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.checkpoint_locations SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.occurrences          SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.alerts               SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.shifts               SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.time_entries         SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.vehicles             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.announcements        SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.messages             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

ALTER TABLE public.clients              ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.rounds               ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.round_checkpoints    ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.checkpoint_locations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.occurrences          ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.alerts               ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.shifts               ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.time_entries         ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.vehicles             ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.announcements        ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.messages             ALTER COLUMN company_id SET NOT NULL;

-- 3) Helper functions (now columns exist)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_company(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_company(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.company_is_active(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT status = 'active' FROM public.companies WHERE id = _company_id), false)
$$;
REVOKE EXECUTE ON FUNCTION public.company_is_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_is_active(uuid) TO authenticated, service_role;

-- 4) Drop units
DROP TABLE IF EXISTS public.units CASCADE;
ALTER TABLE public.profiles             DROP COLUMN IF EXISTS unit_id;
ALTER TABLE public.alerts               DROP COLUMN IF EXISTS unit_id;
ALTER TABLE public.checkpoint_locations DROP COLUMN IF EXISTS unit_id;
ALTER TABLE public.occurrences          DROP COLUMN IF EXISTS unit_id;
ALTER TABLE public.rounds               DROP COLUMN IF EXISTS unit_id;
ALTER TABLE public.shifts               DROP COLUMN IF EXISTS unit_id;
ALTER TABLE public.vehicles             DROP COLUMN IF EXISTS unit_id;

-- 5) New client fields
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes text;

-- 6) client_employees
CREATE TABLE public.client_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_employees TO authenticated;
GRANT ALL ON public.client_employees TO service_role;
ALTER TABLE public.client_employees ENABLE ROW LEVEL SECURITY;

-- 7) client_id on operational tables
ALTER TABLE public.rounds               ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.shifts               ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.occurrences          ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.alerts               ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.checkpoint_locations ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 8) Drop old policies
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('profiles','user_roles','clients','rounds','round_checkpoints',
                        'checkpoint_locations','occurrences','alerts','shifts','time_entries',
                        'vehicles','announcements','messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END$$;

CREATE POLICY companies_super_admin_all ON public.companies FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY companies_member_read ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company(auth.uid()));

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR id = auth.uid()
    OR company_id = public.get_user_company(auth.uid())
  );
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_staff_update ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid()) AND public.is_supervisor_or_admin(auth.uid()))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid()) AND public.is_supervisor_or_admin(auth.uid()))
  );

CREATE POLICY user_roles_read ON public.user_roles FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR (company_id = public.get_user_company(auth.uid()) AND public.is_supervisor_or_admin(auth.uid()))
  );
CREATE POLICY user_roles_super_admin_write ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY user_roles_company_admin_write ON public.user_roles FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company(auth.uid())
    AND public.is_supervisor_or_admin(auth.uid())
    AND role <> 'super_admin'
  )
  WITH CHECK (
    company_id = public.get_user_company(auth.uid())
    AND public.is_supervisor_or_admin(auth.uid())
    AND role <> 'super_admin'
  );

DO $$
DECLARE tbl text;
DECLARE tables text[] := ARRAY['clients','rounds','round_checkpoints','checkpoint_locations',
  'occurrences','alerts','shifts','time_entries','vehicles','announcements','messages','client_employees'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
        USING (
          public.is_super_admin(auth.uid())
          OR (company_id = public.get_user_company(auth.uid())
              AND public.company_is_active(company_id))
        )
    $f$, tbl || '_select', tbl);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
        WITH CHECK (
          public.is_super_admin(auth.uid())
          OR (company_id = public.get_user_company(auth.uid())
              AND public.company_is_active(company_id))
        )
    $f$, tbl || '_insert', tbl);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
        USING (
          public.is_super_admin(auth.uid())
          OR (company_id = public.get_user_company(auth.uid())
              AND public.company_is_active(company_id))
        )
        WITH CHECK (
          public.is_super_admin(auth.uid())
          OR (company_id = public.get_user_company(auth.uid())
              AND public.company_is_active(company_id))
        )
    $f$, tbl || '_update', tbl);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
        USING (
          public.is_super_admin(auth.uid())
          OR (company_id = public.get_user_company(auth.uid())
              AND public.company_is_active(company_id)
              AND public.is_supervisor_or_admin(auth.uid()))
        )
    $f$, tbl || '_delete', tbl);
  END LOOP;
END$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$;

-- Promote rafa to super_admin
UPDATE public.profiles SET company_id = NULL WHERE id = '1e76658a-23a3-4d4a-8a0c-41558da96b57';
DELETE FROM public.user_roles WHERE user_id = '1e76658a-23a3-4d4a-8a0c-41558da96b57';
INSERT INTO public.user_roles (user_id, role, company_id)
VALUES ('1e76658a-23a3-4d4a-8a0c-41558da96b57', 'super_admin', NULL);
