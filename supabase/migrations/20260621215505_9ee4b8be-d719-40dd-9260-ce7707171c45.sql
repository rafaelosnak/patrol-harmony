
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX messages_thread_idx ON public.messages(thread_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_read" ON public.messages FOR SELECT TO authenticated
USING (thread_user_id = auth.uid() OR public.is_supervisor_or_admin(auth.uid()));

CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (thread_user_id = auth.uid() OR public.is_supervisor_or_admin(auth.uid()))
);

CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE TO authenticated
USING (thread_user_id = auth.uid() OR public.is_supervisor_or_admin(auth.uid()))
WITH CHECK (thread_user_id = auth.uid() OR public.is_supervisor_or_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
