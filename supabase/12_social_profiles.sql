-- ============================================================
-- TodosGanamos - Perfiles sociales, seguridad y base de producto
-- Ejecutar en Supabase SQL Editor DESPUES de 11_admin_moderacion.sql
-- ============================================================

-- ------------------------------------------------------------
-- Perfil publico ampliado y picks informativos
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS favorite_competitions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_bookmakers TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plan VARCHAR NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_plan_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'premium'));
  END IF;
END $$;

ALTER TABLE public.pronosticos
  ADD COLUMN IF NOT EXISTS bookmaker VARCHAR,
  ADD COLUMN IF NOT EXISTS stake_simulado NUMERIC(8, 2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cuota_tomada_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.comentarios
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comentarios(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- Redes sociales publicas configurables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_social_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform    VARCHAR     NOT NULL,
  url         TEXT        NOT NULL,
  is_public   BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform),
  CHECK (platform IN (
    'instagram', 'tiktok', 'x', 'youtube', 'twitch', 'telegram',
    'discord', 'whatsapp', 'website', 'linktree', 'kick', 'threads'
  )),
  CHECK (url ~* '^https://[a-z0-9]')
);

CREATE OR REPLACE FUNCTION public.social_link_url_is_valid(link_platform TEXT, link_url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF link_url !~* '^https://[a-z0-9]' OR link_url ~* '^https://[^/]*@' THEN
    RETURN false;
  END IF;

  RETURN CASE link_platform
    WHEN 'instagram' THEN link_url ~* '^https://([a-z0-9-]+\.)*instagram\.com/'
    WHEN 'tiktok' THEN link_url ~* '^https://([a-z0-9-]+\.)*tiktok\.com/'
    WHEN 'x' THEN link_url ~* '^https://([a-z0-9-]+\.)*(x\.com|twitter\.com)/'
    WHEN 'youtube' THEN link_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be)/'
    WHEN 'twitch' THEN link_url ~* '^https://([a-z0-9-]+\.)*twitch\.tv/'
    WHEN 'telegram' THEN link_url ~* '^https://([a-z0-9-]+\.)*(t\.me|telegram\.me)/'
    WHEN 'discord' THEN link_url ~* '^https://([a-z0-9-]+\.)*(discord\.gg|discord\.com)/'
    WHEN 'whatsapp' THEN link_url ~* '^https://([a-z0-9-]+\.)*(whatsapp\.com|wa\.me)/'
    WHEN 'website' THEN true
    WHEN 'linktree' THEN link_url ~* '^https://([a-z0-9-]+\.)*linktr\.ee/'
    WHEN 'kick' THEN link_url ~* '^https://([a-z0-9-]+\.)*kick\.com/'
    WHEN 'threads' THEN link_url ~* '^https://([a-z0-9-]+\.)*threads\.net/'
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_social_links_safe_url_check'
      AND conrelid = 'public.user_social_links'::regclass
  ) THEN
    ALTER TABLE public.user_social_links
      ADD CONSTRAINT user_social_links_safe_url_check
      CHECK (public.social_link_url_is_valid(platform, url));
  END IF;
END $$;

ALTER TABLE public.user_social_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_links_select_public_or_own" ON public.user_social_links;
DROP POLICY IF EXISTS "social_links_insert_own" ON public.user_social_links;
DROP POLICY IF EXISTS "social_links_update_own" ON public.user_social_links;
DROP POLICY IF EXISTS "social_links_delete_own" ON public.user_social_links;

CREATE POLICY "social_links_select_public_or_own"
  ON public.user_social_links FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "social_links_insert_own"
  ON public.user_social_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "social_links_update_own"
  ON public.user_social_links FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "social_links_delete_own"
  ON public.user_social_links FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_social_links_updated_at ON public.user_social_links;
CREATE TRIGGER user_social_links_updated_at
  BEFORE UPDATE ON public.user_social_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Moderacion social y bloqueos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reportes_sociales (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type  VARCHAR     NOT NULL CHECK (target_type IN ('usuario', 'pronostico', 'comentario', 'red_social')),
  target_id    UUID        NOT NULL,
  motivo       VARCHAR     NOT NULL CHECK (motivo IN ('spam', 'abuso', 'suplantacion', 'riesgo', 'ilegal', 'otro')),
  detalle      TEXT,
  estado       VARCHAR     NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'revisado', 'descartado')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.reportes_sociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reportes_sociales_insert_own" ON public.reportes_sociales;
DROP POLICY IF EXISTS "reportes_sociales_select_own_or_admin" ON public.reportes_sociales;
DROP POLICY IF EXISTS "reportes_sociales_update_admin" ON public.reportes_sociales;
DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;

CREATE POLICY "reportes_sociales_insert_own"
  ON public.reportes_sociales FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reportes_sociales_select_own_or_admin"
  ON public.reportes_sociales FOR SELECT
  USING (auth.uid() = reporter_id OR public.is_admin());

CREATE POLICY "reportes_sociales_update_admin"
  ON public.reportes_sociales FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "user_blocks_select_own"
  ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "user_blocks_insert_own"
  ON public.user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "user_blocks_delete_own"
  ON public.user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- ------------------------------------------------------------
-- Likes de comentarios, alertas y notificaciones in-app
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comment_likes (
  comentario_id UUID        NOT NULL REFERENCES public.comentarios(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comentario_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.alertas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        VARCHAR     NOT NULL CHECK (tipo IN (
    'cambio_cuota', 'cuota_objetivo', 'inicio_partido', 'value_bet',
    'pick_seguido', 'equipo_favorito', 'bookmaker_disponible'
  )),
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  channel     VARCHAR     NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'push')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_likes_select_public" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_insert_own" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_delete_own" ON public.comment_likes;
DROP POLICY IF EXISTS "alertas_manage_own" ON public.alertas;
DROP POLICY IF EXISTS "notificaciones_select_own" ON public.notificaciones;
DROP POLICY IF EXISTS "notificaciones_update_own" ON public.notificaciones;
DROP POLICY IF EXISTS "notificaciones_delete_own" ON public.notificaciones;

CREATE POLICY "comment_likes_select_public"
  ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_insert_own"
  ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete_own"
  ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "alertas_manage_own"
  ON public.alertas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notificaciones_select_own"
  ON public.notificaciones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notificaciones_update_own"
  ON public.notificaciones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notificaciones_delete_own"
  ON public.notificaciones FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS alertas_updated_at ON public.alertas;
CREATE TRIGGER alertas_updated_at
  BEFORE UPDATE ON public.alertas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Badges: visibles para todos, asignables solo por administracion
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "user_badges_insert_own" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_insert_admin" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_delete_admin" ON public.user_badges;

CREATE POLICY "user_badges_insert_admin"
  ON public.user_badges FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "user_badges_delete_admin"
  ON public.user_badges FOR DELETE
  USING (public.is_admin());

INSERT INTO public.badges (name, slug, description) VALUES
  ('Usuario verificado', 'verificado', 'Identidad o perfil revisado por TodosGanamos'),
  ('Analista destacado', 'analista-destacado', 'Contenido informativo de especial calidad'),
  ('Buen historial', 'buen-historial', 'Trayectoria simulada consistente'),
  ('Experto en LaLiga', 'experto-laliga', 'Especialista en competiciones espanolas'),
  ('Experto en Premier', 'experto-premier', 'Especialista en Premier League'),
  ('Value hunter', 'value-hunter', 'Detecta cuotas informativas interesantes'),
  ('Usuario fundador', 'fundador', 'Miembro de la etapa inicial de TodosGanamos'),
  ('Premium', 'premium', 'Plan premium activo'),
  ('Moderador', 'moderador', 'Miembro del equipo de moderacion')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ------------------------------------------------------------
-- Indices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_social_links_user_public_order
  ON public.user_social_links(user_id, is_public, sort_order);
CREATE INDEX IF NOT EXISTS idx_reportes_sociales_estado_created_at
  ON public.reportes_sociales(estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON public.user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_alertas_user_active
  ON public.alertas(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_notificaciones_user_created_at
  ON public.notificaciones(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_user_unread
  ON public.notificaciones(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pronosticos_bookmaker
  ON public.pronosticos(bookmaker);
