
-- Add media to occurrences
ALTER TABLE public.occurrences ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.occurrences ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Add GPS track to rounds
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS track JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Storage policies for occurrence-media bucket
CREATE POLICY "Occ media: members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'occurrence-media'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Occ media: own upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'occurrence-media'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Occ media: own update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'occurrence-media'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Occ media: own delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'occurrence-media'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
