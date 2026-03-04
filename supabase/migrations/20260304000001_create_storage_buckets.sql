-- Create storage buckets for check-in and menu photos
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('checkin-photos', 'checkin-photos', true),  -- public: photos served via CDN in img tags
  ('menu-photos', 'menu-photos', false);

-- checkin-photos: authenticated users upload to their own path
CREATE POLICY "Users upload own checkin photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- checkin-photos: public bucket — all reads served via CDN; no SELECT policy needed

-- checkin-photos: users can delete their own photos (PDPA cascade)
CREATE POLICY "Users delete own checkin photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checkin-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- menu-photos: same policies
CREATE POLICY "Users upload own menu photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'menu-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated read menu photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'menu-photos');

CREATE POLICY "Users delete own menu photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'menu-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
