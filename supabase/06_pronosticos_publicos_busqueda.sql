-- ============================================================
-- PULSO - Pronosticos publicos y busqueda
-- Ejecutar en Supabase SQL Editor DESPUES de 05_tablas_espanol.sql
-- ============================================================

-- Busquedas con ILIKE mas rapidas.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Valores validos para controlar que solo lo publico se expone a la comunidad.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pronosticos_visibilidad_check'
      AND conrelid = 'public.pronosticos'::regclass
  ) THEN
    ALTER TABLE public.pronosticos
      ADD CONSTRAINT pronosticos_visibilidad_check
      CHECK (visibilidad IN ('publico', 'seguidores', 'borrador'));
  END IF;
END $$;

-- Politicas de pronosticos: cualquiera puede leer publicos; cada autor puede leer/editar lo suyo.
DROP POLICY IF EXISTS "pronosticos_select_public" ON public.pronosticos;
DROP POLICY IF EXISTS "pronosticos_insert" ON public.pronosticos;
DROP POLICY IF EXISTS "pronosticos_update" ON public.pronosticos;
DROP POLICY IF EXISTS "pronosticos_delete" ON public.pronosticos;

CREATE POLICY "pronosticos_select_public_or_own"
  ON public.pronosticos
  FOR SELECT
  USING (visibilidad = 'publico' OR auth.uid() = user_id);

CREATE POLICY "pronosticos_insert_own"
  ON public.pronosticos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pronosticos_update_own"
  ON public.pronosticos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pronosticos_delete_own"
  ON public.pronosticos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Likes: visibles solo si el pronostico es publico o del usuario autenticado.
DROP POLICY IF EXISTS "likes_select" ON public.likes;
DROP POLICY IF EXISTS "likes_insert" ON public.likes;
DROP POLICY IF EXISTS "likes_delete" ON public.likes;

CREATE POLICY "likes_select_public_pronostico"
  ON public.likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pronosticos p
      WHERE p.id = likes.pronostico_id
        AND (p.visibilidad = 'publico' OR auth.uid() = p.user_id)
    )
  );

CREATE POLICY "likes_insert_own_on_visible_pronostico"
  ON public.likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.pronosticos p
      WHERE p.id = pronostico_id
        AND (p.visibilidad = 'publico' OR auth.uid() = p.user_id)
    )
  );

CREATE POLICY "likes_delete_own"
  ON public.likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comentarios: mismo criterio que likes.
DROP POLICY IF EXISTS "comentarios_select" ON public.comentarios;
DROP POLICY IF EXISTS "comentarios_insert" ON public.comentarios;
DROP POLICY IF EXISTS "comentarios_delete" ON public.comentarios;

CREATE POLICY "comentarios_select_public_pronostico"
  ON public.comentarios
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pronosticos p
      WHERE p.id = comentarios.pronostico_id
        AND (p.visibilidad = 'publico' OR auth.uid() = p.user_id)
    )
  );

CREATE POLICY "comentarios_insert_own_on_visible_pronostico"
  ON public.comentarios
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.pronosticos p
      WHERE p.id = pronostico_id
        AND (p.visibilidad = 'publico' OR auth.uid() = p.user_id)
    )
  );

CREATE POLICY "comentarios_delete_own"
  ON public.comentarios
  FOR DELETE
  USING (auth.uid() = user_id);

-- Guardados: cada usuario ve sus guardados, pero solo puede guardar pronosticos visibles para el.
DROP POLICY IF EXISTS "guardados_select" ON public.guardados;
DROP POLICY IF EXISTS "guardados_insert" ON public.guardados;
DROP POLICY IF EXISTS "guardados_delete" ON public.guardados;

CREATE POLICY "guardados_select_own"
  ON public.guardados
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "guardados_insert_own_on_visible_pronostico"
  ON public.guardados
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.pronosticos p
      WHERE p.id = pronostico_id
        AND (p.visibilidad = 'publico' OR auth.uid() = p.user_id)
    )
  );

CREATE POLICY "guardados_delete_own"
  ON public.guardados
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indices para feed publico, perfiles y busqueda por texto.
CREATE INDEX IF NOT EXISTS idx_pronosticos_visibilidad_created_at
  ON public.pronosticos(visibilidad, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pronosticos_evento_trgm
  ON public.pronosticos USING gin (evento gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pronosticos_mercado_trgm
  ON public.pronosticos USING gin (mercado gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pronosticos_competicion_trgm
  ON public.pronosticos USING gin (competicion gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pronosticos_deporte_trgm
  ON public.pronosticos USING gin (deporte gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pronosticos_explicacion_trgm
  ON public.pronosticos USING gin (explicacion gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON public.profiles USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON public.profiles USING gin (display_name gin_trgm_ops);
