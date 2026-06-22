CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_super_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX support_messages_company_idx ON public.support_messages(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_super_admin_all" ON public.support_messages
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "support_company_select" ON public.support_messages
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "support_company_insert" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company(auth.uid())
    AND sender_id = auth.uid()
    AND from_super_admin = false
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;