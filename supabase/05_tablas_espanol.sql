-- ============================================================
-- TodosGanamos · Tablas con nombres en español (los que usa el código)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- TABLA: pronosticos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pronosticos (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deporte       VARCHAR,
  competicion   VARCHAR,
  evento        VARCHAR       NOT NULL,
  mercado       VARCHAR       NOT NULL,
  cuota         NUMERIC       NOT NULL CHECK (cuota >= 1.01),
  confianza     INTEGER       NOT NULL DEFAULT 3 CHECK (confianza >= 1 AND confianza <= 5),
  explicacion   TEXT,
  estado        VARCHAR       NOT NULL DEFAULT 'pendiente',
  visibilidad   VARCHAR       NOT NULL DEFAULT 'publico',
  fecha_evento  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pronosticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pronosticos_select_public" ON public.pronosticos
  FOR SELECT USING (visibilidad = 'publico' OR auth.uid() = user_id);

CREATE POLICY "pronosticos_insert" ON public.pronosticos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pronosticos_update" ON public.pronosticos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "pronosticos_delete" ON public.pronosticos
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pronosticos_user_id    ON public.pronosticos(user_id);
CREATE INDEX IF NOT EXISTS idx_pronosticos_created_at ON public.pronosticos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pronosticos_estado     ON public.pronosticos(estado);
CREATE INDEX IF NOT EXISTS idx_pronosticos_deporte    ON public.pronosticos(deporte);

-- ------------------------------------------------------------
-- TABLA: likes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.likes (
  pronostico_id  UUID  NOT NULL REFERENCES public.pronosticos(id) ON DELETE CASCADE,
  user_id        UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pronostico_id, user_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- TABLA: comentarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comentarios (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pronostico_id  UUID        NOT NULL REFERENCES public.pronosticos(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contenido      TEXT        NOT NULL CHECK (char_length(TRIM(contenido)) > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comentarios_select" ON public.comentarios FOR SELECT USING (true);
CREATE POLICY "comentarios_insert" ON public.comentarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comentarios_delete" ON public.comentarios FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comentarios_pronostico ON public.comentarios(pronostico_id);

-- ------------------------------------------------------------
-- TABLA: guardados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardados (
  pronostico_id  UUID  NOT NULL REFERENCES public.pronosticos(id) ON DELETE CASCADE,
  user_id        UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pronostico_id, user_id)
);

ALTER TABLE public.guardados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardados_select" ON public.guardados FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "guardados_insert" ON public.guardados FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "guardados_delete" ON public.guardados FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- TABLA: seguimientos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seguimientos (
  follower_id   UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.seguimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seguimientos_select" ON public.seguimientos FOR SELECT USING (true);
CREATE POLICY "seguimientos_insert" ON public.seguimientos FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "seguimientos_delete" ON public.seguimientos FOR DELETE USING (auth.uid() = follower_id);
