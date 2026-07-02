-- 010: storage bucket for user avatars (idempotent)

INSERT INTO storage.buckets (id, name, public)
SELECT 'avatars', 'avatars', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars');

DROP POLICY IF EXISTS storage_avatars_select ON storage.objects;
CREATE POLICY storage_avatars_select ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS storage_avatars_insert ON storage.objects;
CREATE POLICY storage_avatars_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS storage_avatars_update ON storage.objects;
CREATE POLICY storage_avatars_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
