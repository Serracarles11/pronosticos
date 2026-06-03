-- ============================================================
-- TodosGanamos - Cuentas privadas, solicitudes y visibilidad seguidores
-- Ejecutar en Supabase SQL Editor DESPUES de 08_cierre_pronosticos_capturas.sql
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.seguimiento_solicitudes (
  follower_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.seguimiento_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_pronostico(
  pronostico_owner UUID,
  pronostico_visibilidad TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pronostico_visibilidad = 'publico'
    OR auth.uid() = pronostico_owner
    OR (
      pronostico_visibilidad = 'seguidores'
      AND EXISTS (
        SELECT 1
        FROM public.seguimientos s
        WHERE s.follower_id = auth.uid()
          AND s.following_id = pronostico_owner
      )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "pronosticos_select_public_or_own" ON public.pronosticos;
DROP POLICY IF EXISTS "pronosticos_select_public" ON public.pronosticos;
DROP POLICY IF EXISTS "pronosticos_select_visible" ON public.pronosticos;

CREATE POLICY "pronosticos_select_visible"
  ON public.pronosticos
  FOR SELECT
  USING (public.can_view_pronostico(user_id, visibilidad));

DROP POLICY IF EXISTS "likes_select_public_pronostico" ON public.likes;
DROP POLICY IF EXISTS "likes_insert_own_on_visible_pronostico" ON public.likes;
DROP POLICY IF EXISTS "likes_select_visible_pronostico" ON public.likes;

CREATE POLICY "likes_select_visible_pronostico"
  ON public.likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pronosticos p
      WHERE p.id = likes.pronostico_id
        AND public.can_view_pronostico(p.user_id, p.visibilidad)
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
        AND public.can_view_pronostico(p.user_id, p.visibilidad)
    )
  );

DROP POLICY IF EXISTS "comentarios_select_public_pronostico" ON public.comentarios;
DROP POLICY IF EXISTS "comentarios_insert_own_on_visible_pronostico" ON public.comentarios;
DROP POLICY IF EXISTS "comentarios_select_visible_pronostico" ON public.comentarios;

CREATE POLICY "comentarios_select_visible_pronostico"
  ON public.comentarios
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pronosticos p
      WHERE p.id = comentarios.pronostico_id
        AND public.can_view_pronostico(p.user_id, p.visibilidad)
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
        AND public.can_view_pronostico(p.user_id, p.visibilidad)
    )
  );

DROP POLICY IF EXISTS "guardados_insert_own_on_visible_pronostico" ON public.guardados;

CREATE POLICY "guardados_insert_own_on_visible_pronostico"
  ON public.guardados
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.pronosticos p
      WHERE p.id = pronostico_id
        AND public.can_view_pronostico(p.user_id, p.visibilidad)
    )
  );

DROP POLICY IF EXISTS "seguimientos_insert" ON public.seguimientos;
DROP POLICY IF EXISTS "seguimientos_insert_own" ON public.seguimientos;
DROP POLICY IF EXISTS "seguimientos_insert_public_or_accepted_request" ON public.seguimientos;

CREATE POLICY "seguimientos_insert_public_or_accepted_request"
  ON public.seguimientos
  FOR INSERT
  WITH CHECK (
    (
      auth.uid() = follower_id
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = following_id
          AND p.is_private = false
      )
    )
    OR (
      auth.uid() = following_id
      AND EXISTS (
        SELECT 1
        FROM public.seguimiento_solicitudes ss
        WHERE ss.follower_id = seguimientos.follower_id
          AND ss.following_id = seguimientos.following_id
      )
    )
  );

DROP POLICY IF EXISTS "solicitudes_select_participants" ON public.seguimiento_solicitudes;
DROP POLICY IF EXISTS "solicitudes_insert_own_to_private_profile" ON public.seguimiento_solicitudes;
DROP POLICY IF EXISTS "solicitudes_delete_participants" ON public.seguimiento_solicitudes;

CREATE POLICY "solicitudes_select_participants"
  ON public.seguimiento_solicitudes
  FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "solicitudes_insert_own_to_private_profile"
  ON public.seguimiento_solicitudes
  FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = following_id
        AND p.is_private = true
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.seguimientos s
      WHERE s.follower_id = seguimiento_solicitudes.follower_id
        AND s.following_id = seguimiento_solicitudes.following_id
    )
  );

CREATE POLICY "solicitudes_delete_participants"
  ON public.seguimiento_solicitudes
  FOR DELETE
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE INDEX IF NOT EXISTS idx_profiles_is_private
  ON public.profiles(is_private);

CREATE INDEX IF NOT EXISTS idx_solicitudes_following_created_at
  ON public.seguimiento_solicitudes(following_id, created_at DESC);
