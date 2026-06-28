
-- Absences / justifications table
CREATE TABLE IF NOT EXISTS public.absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  absence_date date NOT NULL,
  kind text NOT NULL DEFAULT 'falta', -- falta | atraso | justificada
  reason text,
  doc_url text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  auto_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, absence_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absences TO authenticated;
GRANT ALL ON public.absences TO service_role;

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "absences_select" ON public.absences FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid())
        AND (public.is_supervisor_or_admin(auth.uid()) OR user_id = auth.uid()))
  );

CREATE POLICY "absences_insert" ON public.absences FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid())
        AND (public.is_supervisor_or_admin(auth.uid()) OR user_id = auth.uid()))
  );

CREATE POLICY "absences_update" ON public.absences FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid())
        AND (public.is_supervisor_or_admin(auth.uid())
             OR (user_id = auth.uid() AND status = 'pending')))
  );

CREATE POLICY "absences_delete" ON public.absences FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid())
        AND public.is_supervisor_or_admin(auth.uid()))
  );

CREATE TRIGGER trg_absences_updated_at
  BEFORE UPDATE ON public.absences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_absences_company_id
  BEFORE INSERT ON public.absences
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();

-- Storage policies for absence-docs bucket (private, scoped per-user folder)
CREATE POLICY "absence_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'absence-docs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_supervisor_or_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "absence_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'absence-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "absence_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'absence-docs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_supervisor_or_admin(auth.uid())
    )
  );

-- Function: auto-mark missed shifts as absences
CREATE OR REPLACE FUNCTION public.mark_missed_shifts(_target_date date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  WITH day_shifts AS (
    SELECT s.id, s.user_id, s.company_id, s.start_at, s.end_at
    FROM public.shifts s
    WHERE (s.start_at AT TIME ZONE 'America/Sao_Paulo')::date = _target_date
  ),
  punched AS (
    SELECT DISTINCT user_id
    FROM public.time_entries
    WHERE (punched_at AT TIME ZONE 'America/Sao_Paulo')::date = _target_date
      AND punch_type = 'entrada'
  ),
  missed AS (
    SELECT ds.id, ds.user_id, ds.company_id
    FROM day_shifts ds
    LEFT JOIN punched p ON p.user_id = ds.user_id
    WHERE p.user_id IS NULL
  ),
  ins AS (
    INSERT INTO public.absences (user_id, company_id, shift_id, absence_date, kind, status, auto_generated, reason)
    SELECT user_id, company_id, id, _target_date, 'falta', 'pending', true,
           'Sem registro de entrada no turno programado.'
    FROM missed
    ON CONFLICT (user_id, absence_date) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END;
$$;

-- Schedule daily run at 23:50 Sao Paulo time (02:50 UTC next day)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'mark-missed-shifts-daily',
  '50 2 * * *',
  $$ SELECT public.mark_missed_shifts(); $$
);
