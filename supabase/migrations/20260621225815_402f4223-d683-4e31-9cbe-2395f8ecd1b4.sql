
CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM public.profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl text;
DECLARE tables text[] := ARRAY['clients','rounds','round_checkpoints','checkpoint_locations',
  'occurrences','alerts','shifts','time_entries','vehicles','announcements','messages','client_employees'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_company_id_trg ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER set_company_id_trg BEFORE INSERT ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user()', tbl);
  END LOOP;
END$$;
