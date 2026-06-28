
-- Add selfie_url to time_entries for facial clock-in
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS selfie_url TEXT;

-- Storage policies for punch-selfies bucket
CREATE POLICY "Users can upload their own punch selfies"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'punch-selfies'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own punch selfies"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'punch-selfies'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Staff can view all punch selfies in their company"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'punch-selfies'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'central')
  )
);
