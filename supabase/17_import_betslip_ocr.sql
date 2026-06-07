-- TodosGanamos - Importacion de combinadas desde captura OCR
-- Ejecutar en Supabase SQL Editor despues de 16_football_data_matches.sql

CREATE TABLE IF NOT EXISTS public.bet_imports (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type        TEXT        NOT NULL DEFAULT 'screenshot',
  bookmaker          TEXT,
  original_file_path TEXT,
  extracted_text     TEXT,
  parsed_json        JSONB,
  status             TEXT        NOT NULL DEFAULT 'processed',
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_type IN ('screenshot')),
  CHECK (status IN ('uploaded', 'processing', 'processed', 'failed', 'confirmed', 'discarded'))
);

CREATE TABLE IF NOT EXISTS public.imported_bet_selections (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id   UUID        NOT NULL REFERENCES public.bet_imports(id) ON DELETE CASCADE,
  event_name  TEXT,
  competition TEXT,
  market      TEXT,
  selection   TEXT,
  odds        NUMERIC(10, 4),
  kickoff_at  TIMESTAMPTZ,
  confidence  NUMERIC(4, 3),
  raw_text    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bet_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_bet_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bet_imports_select_own_or_admin" ON public.bet_imports;
DROP POLICY IF EXISTS "bet_imports_insert_own" ON public.bet_imports;
DROP POLICY IF EXISTS "bet_imports_update_own_or_admin" ON public.bet_imports;
DROP POLICY IF EXISTS "bet_imports_delete_own" ON public.bet_imports;

CREATE POLICY "bet_imports_select_own_or_admin"
  ON public.bet_imports
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

CREATE POLICY "bet_imports_insert_own"
  ON public.bet_imports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bet_imports_update_own_or_admin"
  ON public.bet_imports
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

CREATE POLICY "bet_imports_delete_own"
  ON public.bet_imports
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "imported_bet_selections_select_own_or_admin" ON public.imported_bet_selections;
DROP POLICY IF EXISTS "imported_bet_selections_insert_own" ON public.imported_bet_selections;
DROP POLICY IF EXISTS "imported_bet_selections_update_own" ON public.imported_bet_selections;
DROP POLICY IF EXISTS "imported_bet_selections_delete_own" ON public.imported_bet_selections;

CREATE POLICY "imported_bet_selections_select_own_or_admin"
  ON public.imported_bet_selections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bet_imports bi
      WHERE bi.id = import_id
        AND (
          bi.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
          )
        )
    )
  );

CREATE POLICY "imported_bet_selections_insert_own"
  ON public.imported_bet_selections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bet_imports bi
      WHERE bi.id = import_id
        AND bi.user_id = auth.uid()
    )
  );

CREATE POLICY "imported_bet_selections_update_own"
  ON public.imported_bet_selections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bet_imports bi
      WHERE bi.id = import_id
        AND bi.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bet_imports bi
      WHERE bi.id = import_id
        AND bi.user_id = auth.uid()
    )
  );

CREATE POLICY "imported_bet_selections_delete_own"
  ON public.imported_bet_selections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bet_imports bi
      WHERE bi.id = import_id
        AND bi.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_bet_imports_user_created_at
  ON public.bet_imports(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bet_imports_status_created_at
  ON public.bet_imports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imported_bet_selections_import_id
  ON public.imported_bet_selections(import_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bet-imports',
  'bet-imports',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[];

DROP POLICY IF EXISTS "bet_imports_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "bet_imports_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "bet_imports_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "bet_imports_storage_delete_own" ON storage.objects;

CREATE POLICY "bet_imports_storage_select_own"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'bet-imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "bet_imports_storage_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'bet-imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "bet_imports_storage_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'bet-imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'bet-imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "bet_imports_storage_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'bet-imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
