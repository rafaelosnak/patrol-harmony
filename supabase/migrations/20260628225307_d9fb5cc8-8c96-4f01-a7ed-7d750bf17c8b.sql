
-- Shift swap requests
CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  replacement_user_id uuid,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_swap_requests TO authenticated;
GRANT ALL ON public.shift_swap_requests TO service_role;

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swap requester reads own"
  ON public.shift_swap_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.is_supervisor_or_admin(auth.uid()));

CREATE POLICY "swap requester inserts own"
  ON public.shift_swap_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND company_id = public.get_user_company(auth.uid()));

CREATE POLICY "swap admin updates"
  ON public.shift_swap_requests FOR UPDATE TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) AND company_id = public.get_user_company(auth.uid()));

CREATE POLICY "swap admin deletes"
  ON public.shift_swap_requests FOR DELETE TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) AND company_id = public.get_user_company(auth.uid()));

CREATE TRIGGER trg_swap_updated_at BEFORE UPDATE ON public.shift_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: works_on_day for a given shift_type and day-of-month (1-indexed)
CREATE OR REPLACE FUNCTION public.shift_works_on(_shift_type text, _day_of_month int, _dow int)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _shift_type = '12x36' THEN (_day_of_month % 2) = 1
    WHEN _shift_type = '6x1'   THEN (_day_of_month % 7) <> 0
    WHEN _shift_type = '5x1'   THEN (_day_of_month % 6) <> 0
    WHEN _shift_type = '4x2'   THEN (_day_of_month % 6) NOT IN (5,0)
    WHEN _shift_type = '5x2'   THEN _dow BETWEEN 1 AND 5
    ELSE true
  END
$$;

-- Auto generate monthly schedule for a company
CREATE OR REPLACE FUNCTION public.generate_monthly_schedule(
  _company_id uuid,
  _year int,
  _month int,
  _overwrite boolean DEFAULT false
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  created int := 0;
  v_user record;
  d date;
  first_day date := make_date(_year, _month, 1);
  last_day date := (first_day + interval '1 month - 1 day')::date;
  s_start time; s_end time;
  start_ts timestamptz; end_ts timestamptz;
  v_shift_type text;
  v_period text;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF public.get_user_company(auth.uid()) <> _company_id AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Empresa inválida';
  END IF;

  IF _overwrite THEN
    DELETE FROM public.shifts
     WHERE company_id = _company_id
       AND start_at >= first_day::timestamptz
       AND start_at <  (last_day + 1)::timestamptz;
  END IF;

  FOR v_user IN
    SELECT p.id, p.default_shift_type, p.work_period
      FROM public.profiles p
      JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'vigia'
     WHERE p.company_id = _company_id
  LOOP
    v_shift_type := COALESCE(v_user.default_shift_type, '12x36');
    v_period := UPPER(COALESCE(v_user.work_period, 'A'));

    SELECT
      CASE v_period WHEN 'A' THEN shift_a_start WHEN 'B' THEN shift_b_start WHEN 'C' THEN shift_c_start ELSE '07:00'::time END,
      CASE v_period WHEN 'A' THEN shift_a_end   WHEN 'B' THEN shift_b_end   WHEN 'C' THEN shift_c_end   ELSE '19:00'::time END
    INTO s_start, s_end
    FROM public.companies WHERE id = _company_id;

    s_start := COALESCE(s_start, '07:00'::time);
    s_end   := COALESCE(s_end,   '19:00'::time);

    d := first_day;
    WHILE d <= last_day LOOP
      IF public.shift_works_on(v_shift_type, EXTRACT(DAY FROM d)::int, EXTRACT(ISODOW FROM d)::int) THEN
        start_ts := (d + s_start)::timestamptz;
        end_ts   := CASE WHEN s_end > s_start
                         THEN (d + s_end)::timestamptz
                         ELSE ((d + 1) + s_end)::timestamptz END;

        IF NOT EXISTS (
          SELECT 1 FROM public.shifts
           WHERE user_id = v_user.id
             AND start_at = start_ts
        ) THEN
          INSERT INTO public.shifts (user_id, company_id, shift_type, start_at, end_at, status)
          VALUES (v_user.id, _company_id, v_shift_type, start_ts, end_ts, 'agendado');
          created := created + 1;
        END IF;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN created;
END;
$$;
