-- ============================================================
-- TodosGanamos - Cierre de pronosticos con captura obligatoria
-- Ejecutar en Supabase SQL Editor DESPUES de 05_tablas_espanol.sql
-- ============================================================

ALTER TABLE public.pronosticos
  ADD COLUMN IF NOT EXISTS resultado_captura_path TEXT,
  ADD COLUMN IF NOT EXISTS resultado_captura_url TEXT,
  ADD COLUMN IF NOT EXISTS resultado_reportado_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pronosticos_resultado_reportado_at
  ON public.pronosticos(resultado_reportado_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capturas-pronosticos',
  'capturas-pronosticos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "capturas_pronosticos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "capturas_pronosticos_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "capturas_pronosticos_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "capturas_pronosticos_delete_own_folder" ON storage.objects;

CREATE POLICY "capturas_pronosticos_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'capturas-pronosticos');

CREATE POLICY "capturas_pronosticos_insert_own_folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'capturas-pronosticos'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "capturas_pronosticos_update_own_folder"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'capturas-pronosticos'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'capturas-pronosticos'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "capturas_pronosticos_delete_own_folder"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'capturas-pronosticos'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );
