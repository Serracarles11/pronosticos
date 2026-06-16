-- TodosGanamos - Extractor IA para capturas de apuestas
-- Ejecutar despues de 17_import_betslip_ocr.sql

ALTER TABLE public.bet_imports
  ADD COLUMN IF NOT EXISTS extraction_provider TEXT,
  ADD COLUMN IF NOT EXISTS extraction_model TEXT,
  ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS raw_provider_json JSONB,
  ADD COLUMN IF NOT EXISTS validated_json JSONB;

ALTER TABLE public.bet_imports
  DROP CONSTRAINT IF EXISTS bet_imports_extraction_provider_check;

ALTER TABLE public.bet_imports
  ADD CONSTRAINT bet_imports_extraction_provider_check
  CHECK (
    extraction_provider IS NULL
    OR extraction_provider IN ('openai', 'tesseract', 'manual')
  );

CREATE INDEX IF NOT EXISTS idx_bet_imports_extraction_provider
  ON public.bet_imports(extraction_provider, created_at DESC);
