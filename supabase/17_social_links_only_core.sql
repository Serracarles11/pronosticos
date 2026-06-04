-- ============================================================
-- TodosGanamos - Redes sociales limitadas a TikTok, Instagram y X
-- Ejecutar en Supabase SQL Editor DESPUES de 12_social_profiles.sql
-- ============================================================

DELETE FROM public.user_social_links
WHERE platform NOT IN ('tiktok', 'instagram', 'x');

UPDATE public.profiles
SET social_links = COALESCE(
  (
    SELECT jsonb_agg(item)
    FROM jsonb_array_elements(social_links) AS item
    WHERE item->>'platform' IN ('tiktok', 'instagram', 'x')
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof(social_links) = 'array';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_social_links_platform_check'
      AND conrelid = 'public.user_social_links'::regclass
  ) THEN
    ALTER TABLE public.user_social_links
      DROP CONSTRAINT user_social_links_platform_check;
  END IF;

  ALTER TABLE public.user_social_links
    ADD CONSTRAINT user_social_links_platform_check
    CHECK (platform IN ('tiktok', 'instagram', 'x'));
END $$;

CREATE OR REPLACE FUNCTION public.social_link_url_is_valid(link_platform TEXT, link_url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF link_url !~* '^https://[a-z0-9]' OR link_url ~* '^https://[^/]*@' THEN
    RETURN false;
  END IF;

  RETURN CASE link_platform
    WHEN 'tiktok' THEN link_url ~* '^https://([a-z0-9-]+\.)*tiktok\.com/'
    WHEN 'instagram' THEN link_url ~* '^https://([a-z0-9-]+\.)*instagram\.com/'
    WHEN 'x' THEN link_url ~* '^https://([a-z0-9-]+\.)*(x\.com|twitter\.com)/'
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
