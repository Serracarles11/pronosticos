-- ============================================================
-- TodosGanamos - Fallback de redes sociales en profiles
-- Ejecutar en Supabase SQL Editor si user_social_links aun no esta aplicada
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_social_links_array_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_social_links_array_check
      CHECK (jsonb_typeof(social_links) = 'array');
  END IF;
END $$;
