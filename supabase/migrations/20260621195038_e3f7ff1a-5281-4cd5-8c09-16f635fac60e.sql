ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS hired_at date,
  ADD COLUMN IF NOT EXISTS notes text;

-- Allow admins/supervisors to update any profile (for the edit form)
DROP POLICY IF EXISTS "staff_update_all_profiles" ON public.profiles;
CREATE POLICY "staff_update_all_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()))
  WITH CHECK (public.is_supervisor_or_admin(auth.uid()));

-- Storage policies for the employee-docs bucket (created via tool below)
DROP POLICY IF EXISTS "employee_docs_select_own_or_staff" ON storage.objects;
CREATE POLICY "employee_docs_select_own_or_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-docs' AND (
      public.is_supervisor_or_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "employee_docs_insert_staff" ON storage.objects;
CREATE POLICY "employee_docs_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-docs' AND public.is_supervisor_or_admin(auth.uid())
  );

DROP POLICY IF EXISTS "employee_docs_delete_staff" ON storage.objects;
CREATE POLICY "employee_docs_delete_staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-docs' AND public.is_supervisor_or_admin(auth.uid())
  );