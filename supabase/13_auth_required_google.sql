-- ============================================================
-- TodosGanamos - Acceso autenticado a pronosticos y perfiles OAuth
-- Ejecutar en Supabase SQL Editor DESPUES de 12_social_profiles.sql
-- ============================================================

-- Los usuarios OAuth reciben un perfil aunque no pasen por el formulario local.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  profile_name TEXT;
  suffix INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'username', ''), SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), 'usuario'),
    '[^a-z0-9_]',
    '_',
    'g'
  ));

  IF CHAR_LENGTH(base_username) < 3 THEN
    base_username := 'usuario';
  END IF;

  base_username := LEFT(base_username, 24);
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := LEFT(base_username, 24 - CHAR_LENGTH(suffix::TEXT)) || suffix::TEXT;
  END LOOP;

  profile_name := LEFT(COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    final_username
  ), 40);

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, final_username, profile_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Los picks solo se leen con una cuenta autenticada. El resto de politicas
-- reutilizan esta funcion para likes, comentarios y guardados.
CREATE OR REPLACE FUNCTION public.can_view_pronostico(
  pronostico_owner UUID,
  pronostico_visibilidad TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL
    AND (
      pronostico_visibilidad = 'publico'
      OR auth.uid() = pronostico_owner
      OR (
        pronostico_visibilidad = 'seguidores'
        AND EXISTS (
          SELECT 1
          FROM public.seguimientos s
          WHERE s.follower_id = auth.uid()
            AND s.following_id = pronostico_owner
        )
      )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Compatibilidad con las tablas iniciales en ingles, si siguen activas.
DO $$
BEGIN
  IF TO_REGCLASS('public.predictions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "predictions_select_public" ON public.predictions';
    EXECUTE 'DROP POLICY IF EXISTS "predictions_select_authenticated" ON public.predictions';
    EXECUTE '
      CREATE POLICY "predictions_select_authenticated"
        ON public.predictions
        FOR SELECT
        TO authenticated
        USING (true)
    ';
  END IF;
END;
$$;
