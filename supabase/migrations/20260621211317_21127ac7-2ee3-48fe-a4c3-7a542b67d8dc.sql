CREATE POLICY "Auth users read round photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'round-photos');

CREATE POLICY "Auth users upload round photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'round-photos' AND owner = auth.uid());

CREATE POLICY "Auth users delete own round photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'round-photos' AND owner = auth.uid());
