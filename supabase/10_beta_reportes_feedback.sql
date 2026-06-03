-- ============================================================
-- TodosGanamos - Beta feedback y reportes de contenido
-- Ejecutar en Supabase SQL Editor DESPUES de 09_privacidad_solicitudes.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reportes_pronosticos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pronostico_id  UUID        NOT NULL REFERENCES public.pronosticos(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  motivo         VARCHAR     NOT NULL CHECK (motivo IN ('spam', 'abuso', 'riesgo', 'ilegal', 'otro')),
  detalle        TEXT,
  estado         VARCHAR     NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'revisado', 'descartado')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pronostico_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  categoria   VARCHAR     NOT NULL CHECK (categoria IN ('bug', 'idea', 'ux', 'contenido', 'otro')),
  mensaje     TEXT        NOT NULL CHECK (char_length(TRIM(mensaje)) >= 8),
  page_url    TEXT,
  rating      INTEGER     CHECK (rating >= 1 AND rating <= 5),
  estado      VARCHAR     NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'revisado', 'cerrado')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reportes_pronosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reportes_insert_own" ON public.reportes_pronosticos;
DROP POLICY IF EXISTS "reportes_select_own" ON public.reportes_pronosticos;

CREATE POLICY "reportes_insert_own"
  ON public.reportes_pronosticos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reportes_select_own"
  ON public.reportes_pronosticos
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedback_insert_public_or_own" ON public.beta_feedback;
DROP POLICY IF EXISTS "feedback_select_own" ON public.beta_feedback;

CREATE POLICY "feedback_insert_public_or_own"
  ON public.beta_feedback
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "feedback_select_own"
  ON public.beta_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reportes_pronosticos_estado_created_at
  ON public.reportes_pronosticos(estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_estado_created_at
  ON public.beta_feedback(estado, created_at DESC);
