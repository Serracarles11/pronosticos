-- ============================================================
-- TodosGanamos · Funciones y Triggers
-- Ejecuta DESPUES de 02_rls.sql
-- ============================================================

-- ------------------------------------------------------------
-- updated_at automatico
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.prediction_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Perfil automatico al registrarse
-- Si el usuario ya inserto su perfil desde la app (con username),
-- el ON CONFLICT DO NOTHING evita sobreescribirlo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9_]', '_', 'g'));
  final_username := base_username;

  -- Buscar username unico si ya existe
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, final_username, final_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- Actualizar likes_count en predictions al dar/quitar like
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.predictions
    SET likes_count = likes_count + 1
    WHERE id = NEW.prediction_id;
    -- Actualizar total_likes del autor
    UPDATE public.profiles p
    SET total_likes = total_likes + 1
    FROM public.predictions pr
    WHERE pr.id = NEW.prediction_id AND pr.user_id = p.id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.predictions
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.prediction_id;
    UPDATE public.profiles p
    SET total_likes = GREATEST(total_likes - 1, 0)
    FROM public.predictions pr
    WHERE pr.id = OLD.prediction_id AND pr.user_id = p.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_prediction_like
  AFTER INSERT OR DELETE ON public.prediction_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- ------------------------------------------------------------
-- Actualizar comments_count al comentar
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.predictions SET comments_count = comments_count + 1 WHERE id = NEW.prediction_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.predictions SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.prediction_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_prediction_comment
  AFTER INSERT OR DELETE ON public.prediction_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();

-- ------------------------------------------------------------
-- Actualizar followers/following count
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE public.profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_follow_change
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();
