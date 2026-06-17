-- ============================================================
-- TodosGanamos - Avatares de perfil
-- Ejecutar en Supabase SQL Editor DESPUES de 19_notificaciones_eventos.sql
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "profile_avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "profile_avatars_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "profile_avatars_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "profile_avatars_delete_own_folder" ON storage.objects;

CREATE POLICY "profile_avatars_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'profile-avatars');

CREATE POLICY "profile_avatars_insert_own_folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "profile_avatars_update_own_folder"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profile-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "profile_avatars_delete_own_folder"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
