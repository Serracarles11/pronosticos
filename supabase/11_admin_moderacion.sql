-- ============================================================
-- TodosGanamos - Rol admin y politicas de moderacion
-- Ejecutar en Supabase SQL Editor DESPUES de 10_beta_reportes_feedback.sql
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "reportes_select_own" ON public.reportes_pronosticos;
DROP POLICY IF EXISTS "reportes_update_admin" ON public.reportes_pronosticos;

CREATE POLICY "reportes_select_own_or_admin"
  ON public.reportes_pronosticos
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "reportes_update_admin"
  ON public.reportes_pronosticos
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "feedback_select_own" ON public.beta_feedback;
DROP POLICY IF EXISTS "feedback_update_admin" ON public.beta_feedback;

CREATE POLICY "feedback_select_own_or_admin"
  ON public.beta_feedback
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "feedback_update_admin"
  ON public.beta_feedback
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);
