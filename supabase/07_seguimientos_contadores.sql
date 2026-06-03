-- ============================================================
-- TodosGanamos - Contadores para seguimientos
-- Ejecutar en Supabase SQL Editor DESPUES de 05_tablas_espanol.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_seguimientos_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET following_count = following_count + 1
    WHERE id = NEW.follower_id;

    UPDATE public.profiles
    SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET following_count = GREATEST(following_count - 1, 0)
    WHERE id = OLD.follower_id;

    UPDATE public.profiles
    SET followers_count = GREATEST(followers_count - 1, 0)
    WHERE id = OLD.following_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_seguimiento_change ON public.seguimientos;

CREATE TRIGGER on_seguimiento_change
  AFTER INSERT OR DELETE ON public.seguimientos
  FOR EACH ROW EXECUTE FUNCTION public.update_seguimientos_counts();

-- Recalcula contadores actuales por si ya habia seguimientos creados.
UPDATE public.profiles
SET followers_count = 0,
    following_count = 0;

UPDATE public.profiles p
SET followers_count = counts.total
FROM (
  SELECT following_id, COUNT(*)::INTEGER AS total
  FROM public.seguimientos
  GROUP BY following_id
) counts
WHERE p.id = counts.following_id;

UPDATE public.profiles p
SET following_count = counts.total
FROM (
  SELECT follower_id, COUNT(*)::INTEGER AS total
  FROM public.seguimientos
  GROUP BY follower_id
) counts
WHERE p.id = counts.follower_id;
