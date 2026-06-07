-- ============================================================
-- TodosGanamos - Eventos de notificaciones in-app
-- Ejecutar en Supabase SQL Editor DESPUES de 18_add_mundial_competition.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        VARCHAR     NOT NULL,
  titulo      VARCHAR     NOT NULL,
  mensaje     TEXT        NOT NULL,
  href        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificaciones_select_own" ON public.notificaciones;
DROP POLICY IF EXISTS "notificaciones_update_own" ON public.notificaciones;
DROP POLICY IF EXISTS "notificaciones_delete_own" ON public.notificaciones;

CREATE POLICY "notificaciones_select_own"
  ON public.notificaciones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notificaciones_update_own"
  ON public.notificaciones FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notificaciones_delete_own"
  ON public.notificaciones FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notificaciones_user_created_at
  ON public.notificaciones(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_user_unread
  ON public.notificaciones(user_id, read_at) WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notificaciones_user_dedupe_key
  ON public.notificaciones(user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_notificaciones_entity
  ON public.notificaciones(entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.notification_actor_name(actor UUID)
RETURNS TEXT AS $$
DECLARE
  label TEXT;
BEGIN
  SELECT COALESCE(NULLIF(username, ''), NULLIF(display_name, ''))
    INTO label
  FROM public.profiles
  WHERE id = actor;

  IF label IS NULL THEN
    RETURN 'Alguien';
  END IF;

  RETURN '@' || label;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notification_profile_href(profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  profile_username TEXT;
BEGIN
  SELECT username INTO profile_username
  FROM public.profiles
  WHERE id = profile_id;

  IF profile_username IS NULL OR profile_username = '' THEN
    RETURN '/feed';
  END IF;

  RETURN '/u/' || profile_username;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notification_pick_message(
  event_name TEXT,
  odds NUMERIC
)
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(NULLIF(event_name, ''), 'Nuevo pronostico')
    || ' - cuota '
    || COALESCE(ROUND(odds, 2)::TEXT, '--');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.notification_allowed(
  recipient UUID,
  actor UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  IF recipient IS NULL OR actor IS NULL OR recipient = actor THEN
    RETURN false;
  END IF;

  IF to_regclass('public.user_mutes') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_mutes m
      WHERE m.muter_user_id = recipient
        AND m.muted_user_id = actor
    ) THEN
      RETURN false;
    END IF;
  END IF;

  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_blocks b
      WHERE (b.blocker_id = recipient AND b.blocked_id = actor)
         OR (b.blocker_id = actor AND b.blocked_id = recipient)
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id UUID,
  p_tipo TEXT,
  p_titulo TEXT,
  p_mensaje TEXT,
  p_href TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_dedupe_key TEXT DEFAULT NULL,
  p_metadata_json JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_actor_id IS NOT NULL AND NOT public.notification_allowed(p_user_id, p_actor_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.notificaciones (
    user_id,
    tipo,
    titulo,
    mensaje,
    href,
    actor_id,
    entity_type,
    entity_id,
    dedupe_key,
    metadata_json
  )
  VALUES (
    p_user_id,
    p_tipo,
    p_titulo,
    p_mensaje,
    p_href,
    p_actor_id,
    p_entity_type,
    p_entity_id,
    p_dedupe_key,
    COALESCE(p_metadata_json, '{}'::jsonb)
  )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notify_pronostico_to_followers()
RETURNS TRIGGER AS $$
DECLARE
  recipient UUID;
  actor_label TEXT;
BEGIN
  IF NEW.visibilidad = 'borrador'
     OR COALESCE(to_jsonb(NEW)->>'moderation_status', 'approved') <> 'approved' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(to_jsonb(OLD)->>'moderation_status', 'approved') = 'approved'
     AND OLD.visibilidad IS NOT DISTINCT FROM NEW.visibilidad THEN
    RETURN NULL;
  END IF;

  actor_label := public.notification_actor_name(NEW.user_id);

  FOR recipient IN
    SELECT s.follower_id
    FROM public.seguimientos s
    WHERE s.following_id = NEW.user_id
  LOOP
    PERFORM public.enqueue_notification(
      recipient,
      'nuevo_pronostico_seguido',
      'Nueva cuota de ' || actor_label,
      public.notification_pick_message(NEW.evento, NEW.cuota),
      '/detalle?id=' || NEW.id,
      NEW.user_id,
      'pronostico',
      NEW.id,
      'pronostico-seguido:' || NEW.id,
      jsonb_build_object('cuota', NEW.cuota, 'evento', NEW.evento)
    );
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_pronostico_notify_followers ON public.pronosticos;
CREATE TRIGGER on_pronostico_notify_followers
  AFTER INSERT OR UPDATE ON public.pronosticos
  FOR EACH ROW EXECUTE FUNCTION public.notify_pronostico_to_followers();

CREATE OR REPLACE FUNCTION public.notify_pronostico_like()
RETURNS TRIGGER AS $$
DECLARE
  p RECORD;
  actor_label TEXT;
BEGIN
  SELECT id, user_id, evento, cuota
    INTO p
  FROM public.pronosticos
  WHERE id = NEW.pronostico_id;

  IF p.id IS NULL OR p.user_id = NEW.user_id THEN
    RETURN NULL;
  END IF;

  actor_label := public.notification_actor_name(NEW.user_id);

  PERFORM public.enqueue_notification(
    p.user_id,
    'like_pronostico',
    actor_label || ' le dio corazon a tu pronostico',
    public.notification_pick_message(p.evento, p.cuota),
    '/detalle?id=' || p.id,
    NEW.user_id,
    'pronostico',
    p.id,
    'like:' || p.id || ':' || NEW.user_id,
    '{}'::jsonb
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_like_notify_owner ON public.likes;
CREATE TRIGGER on_like_notify_owner
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_pronostico_like();

CREATE OR REPLACE FUNCTION public.notify_pronostico_saved()
RETURNS TRIGGER AS $$
DECLARE
  p RECORD;
  actor_label TEXT;
BEGIN
  SELECT id, user_id, evento, cuota
    INTO p
  FROM public.pronosticos
  WHERE id = NEW.pronostico_id;

  IF p.id IS NULL OR p.user_id = NEW.user_id THEN
    RETURN NULL;
  END IF;

  actor_label := public.notification_actor_name(NEW.user_id);

  PERFORM public.enqueue_notification(
    p.user_id,
    'guardado_pronostico',
    actor_label || ' guardo tu pronostico',
    public.notification_pick_message(p.evento, p.cuota),
    '/detalle?id=' || p.id,
    NEW.user_id,
    'pronostico',
    p.id,
    'guardado:' || p.id || ':' || NEW.user_id,
    '{}'::jsonb
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_guardado_notify_owner ON public.guardados;
CREATE TRIGGER on_guardado_notify_owner
  AFTER INSERT ON public.guardados
  FOR EACH ROW EXECUTE FUNCTION public.notify_pronostico_saved();

CREATE OR REPLACE FUNCTION public.notify_pronostico_comment()
RETURNS TRIGGER AS $$
DECLARE
  p RECORD;
  actor_label TEXT;
  recipient UUID;
BEGIN
  IF COALESCE(to_jsonb(NEW)->>'moderation_status', 'approved') <> 'approved' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(to_jsonb(OLD)->>'moderation_status', 'approved') = 'approved' THEN
    RETURN NULL;
  END IF;

  SELECT id, user_id, evento, cuota
    INTO p
  FROM public.pronosticos
  WHERE id = NEW.pronostico_id;

  IF p.id IS NULL THEN
    RETURN NULL;
  END IF;

  actor_label := public.notification_actor_name(NEW.user_id);

  FOR recipient IN
    SELECT p.user_id
    UNION
    SELECT c.user_id
    FROM public.comentarios c
    WHERE c.pronostico_id = NEW.pronostico_id
      AND c.id <> NEW.id
    UNION
    SELECT g.user_id
    FROM public.guardados g
    WHERE g.pronostico_id = NEW.pronostico_id
  LOOP
    PERFORM public.enqueue_notification(
      recipient,
      CASE WHEN recipient = p.user_id THEN 'comentario_pronostico' ELSE 'comentario_hilo' END,
      CASE
        WHEN recipient = p.user_id THEN actor_label || ' comento tu pronostico'
        ELSE 'Nuevo comentario en un pronostico que sigues'
      END,
      public.notification_pick_message(p.evento, p.cuota),
      '/detalle?id=' || p.id || '#comentarios',
      NEW.user_id,
      'comentario',
      NEW.id,
      'comentario:' || NEW.id,
      '{}'::jsonb
    );
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_comentario_notify_related ON public.comentarios;
CREATE TRIGGER on_comentario_notify_related
  AFTER INSERT OR UPDATE ON public.comentarios
  FOR EACH ROW EXECUTE FUNCTION public.notify_pronostico_comment();

CREATE OR REPLACE FUNCTION public.notify_pronostico_result()
RETURNS TRIGGER AS $$
DECLARE
  recipient UUID;
  actor_label TEXT;
BEGIN
  IF NEW.estado NOT IN ('acertada', 'fallada')
     OR OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NULL;
  END IF;

  actor_label := public.notification_actor_name(NEW.user_id);

  FOR recipient IN
    SELECT s.follower_id
    FROM public.seguimientos s
    WHERE s.following_id = NEW.user_id
    UNION
    SELECT l.user_id
    FROM public.likes l
    WHERE l.pronostico_id = NEW.id
    UNION
    SELECT g.user_id
    FROM public.guardados g
    WHERE g.pronostico_id = NEW.id
    UNION
    SELECT c.user_id
    FROM public.comentarios c
    WHERE c.pronostico_id = NEW.id
  LOOP
    PERFORM public.enqueue_notification(
      recipient,
      'resultado_pronostico',
      actor_label || ' marco un pronostico como ' || NEW.estado,
      public.notification_pick_message(NEW.evento, NEW.cuota),
      '/detalle?id=' || NEW.id,
      NEW.user_id,
      'pronostico',
      NEW.id,
      'resultado:' || NEW.id || ':' || NEW.estado,
      jsonb_build_object('estado', NEW.estado)
    );
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_pronostico_result_notify_related ON public.pronosticos;
CREATE TRIGGER on_pronostico_result_notify_related
  AFTER UPDATE OF estado ON public.pronosticos
  FOR EACH ROW EXECUTE FUNCTION public.notify_pronostico_result();

CREATE OR REPLACE FUNCTION public.notify_follow_request()
RETURNS TRIGGER AS $$
DECLARE
  actor_label TEXT;
BEGIN
  actor_label := public.notification_actor_name(NEW.follower_id);

  PERFORM public.enqueue_notification(
    NEW.following_id,
    'solicitud_seguimiento',
    actor_label || ' quiere seguirte',
    'Revisa la solicitud desde tu cuenta.',
    '/cuenta',
    NEW.follower_id,
    'usuario',
    NEW.follower_id,
    'follow-request:' || NEW.follower_id || ':' || NEW.following_id,
    '{}'::jsonb
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF to_regclass('public.seguimiento_solicitudes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_solicitud_notify_owner ON public.seguimiento_solicitudes;
    CREATE TRIGGER on_solicitud_notify_owner
      AFTER INSERT ON public.seguimiento_solicitudes
      FOR EACH ROW EXECUTE FUNCTION public.notify_follow_request();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_follow_change()
RETURNS TRIGGER AS $$
DECLARE
  actor_label TEXT;
  request_exists BOOLEAN;
BEGIN
  request_exists := false;

  IF to_regclass('public.seguimiento_solicitudes') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.seguimiento_solicitudes ss
      WHERE ss.follower_id = NEW.follower_id
        AND ss.following_id = NEW.following_id
    ) INTO request_exists;
  END IF;

  IF request_exists THEN
    actor_label := public.notification_actor_name(NEW.following_id);
    PERFORM public.enqueue_notification(
      NEW.follower_id,
      'seguimiento_aceptado',
      actor_label || ' acepto tu solicitud',
      'Ya puedes ver sus cuotas para seguidores.',
      public.notification_profile_href(NEW.following_id),
      NEW.following_id,
      'usuario',
      NEW.following_id,
      'follow-accepted:' || NEW.follower_id || ':' || NEW.following_id,
      '{}'::jsonb
    );
  ELSE
    actor_label := public.notification_actor_name(NEW.follower_id);
    PERFORM public.enqueue_notification(
      NEW.following_id,
      'nuevo_seguidor',
      actor_label || ' te sigue',
      'Recibira tus nuevas cuotas en su feed.',
      public.notification_profile_href(NEW.follower_id),
      NEW.follower_id,
      'usuario',
      NEW.follower_id,
      'follow:' || NEW.follower_id || ':' || NEW.following_id,
      '{}'::jsonb
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_seguimiento_notify_related ON public.seguimientos;
CREATE TRIGGER on_seguimiento_notify_related
  AFTER INSERT ON public.seguimientos
  FOR EACH ROW EXECUTE FUNCTION public.notify_follow_change();
