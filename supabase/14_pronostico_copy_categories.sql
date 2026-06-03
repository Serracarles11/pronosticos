-- ============================================================
-- TodosGanamos - Link de copia y categorias de pronosticos
-- Ejecutar en Supabase SQL Editor DESPUES de 13_auth_required_google.sql
-- ============================================================

ALTER TABLE public.pronosticos
  ADD COLUMN IF NOT EXISTS copy_link TEXT,
  ADD COLUMN IF NOT EXISTS categorias TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pronosticos_copy_link_safe'
      AND conrelid = 'public.pronosticos'::regclass
  ) THEN
    ALTER TABLE public.pronosticos
      ADD CONSTRAINT pronosticos_copy_link_safe
      CHECK (
        copy_link IS NULL
        OR (
          copy_link ~* '^https://'
          AND copy_link !~* '[[:space:]]'
          AND char_length(copy_link) <= 500
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pronosticos_categorias
  ON public.pronosticos USING gin (categorias);
