-- ============================================================
-- TodosGanamos - Anti-spam y moderacion ligera
-- Ejecutar en Supabase SQL Editor DESPUES de 14_pronostico_copy_categories.sql
-- ============================================================

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

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shadowban_reason TEXT,
  ADD COLUMN IF NOT EXISTS shadowbanned_at TIMESTAMPTZ;

ALTER TABLE public.pronosticos
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS event_key TEXT;

ALTER TABLE public.comentarios
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pronosticos_moderation_status_check'
      AND conrelid = 'public.pronosticos'::regclass
  ) THEN
    ALTER TABLE public.pronosticos
      ADD CONSTRAINT pronosticos_moderation_status_check
      CHECK (moderation_status IN ('approved', 'pending_review', 'rejected', 'hidden'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comentarios_moderation_status_check'
      AND conrelid = 'public.comentarios'::regclass
  ) THEN
    ALTER TABLE public.comentarios
      ADD CONSTRAINT comentarios_moderation_status_check
      CHECK (moderation_status IN ('approved', 'pending_review', 'rejected', 'hidden'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.blocked_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  severity VARCHAR NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocked_words_word_not_empty CHECK (length(trim(word)) > 0),
  CONSTRAINT blocked_words_severity_check CHECK (severity IN ('low', 'medium', 'high'))
);

CREATE TABLE IF NOT EXISTS public.anti_spam_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type VARCHAR NOT NULL,
  target_type VARCHAR,
  target_id UUID,
  severity VARCHAR NOT NULL DEFAULT 'low',
  reason TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT anti_spam_events_severity_check CHECK (severity IN ('info', 'low', 'medium', 'high'))
);

CREATE TABLE IF NOT EXISTS public.user_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_mutes_no_self CHECK (muter_user_id <> muted_user_id),
  CONSTRAINT user_mutes_unique UNIQUE (muter_user_id, muted_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_words_active
  ON public.blocked_words(is_active, severity);

CREATE INDEX IF NOT EXISTS idx_anti_spam_events_user_created
  ON public.anti_spam_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anti_spam_events_type_created
  ON public.anti_spam_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anti_spam_events_metadata_gin
  ON public.anti_spam_events USING gin (metadata_json);

CREATE INDEX IF NOT EXISTS idx_user_mutes_muter
  ON public.user_mutes(muter_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_mutes_muted
  ON public.user_mutes(muted_user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_shadowbanned
  ON public.profiles(is_shadowbanned)
  WHERE is_shadowbanned = true;

CREATE INDEX IF NOT EXISTS idx_pronosticos_moderation_status
  ON public.pronosticos(moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pronosticos_user_event_key
  ON public.pronosticos(user_id, event_key)
  WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comentarios_moderation_status
  ON public.comentarios(moderation_status, created_at DESC);

DROP TRIGGER IF EXISTS blocked_words_set_updated_at ON public.blocked_words;
CREATE TRIGGER blocked_words_set_updated_at
  BEFORE UPDATE ON public.blocked_words
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.blocked_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_spam_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_words_select_admin" ON public.blocked_words;
DROP POLICY IF EXISTS "blocked_words_insert_admin" ON public.blocked_words;
DROP POLICY IF EXISTS "blocked_words_update_admin" ON public.blocked_words;
DROP POLICY IF EXISTS "blocked_words_delete_admin" ON public.blocked_words;

CREATE POLICY "blocked_words_select_admin"
  ON public.blocked_words FOR SELECT
  USING (public.is_admin());

CREATE POLICY "blocked_words_insert_admin"
  ON public.blocked_words FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "blocked_words_update_admin"
  ON public.blocked_words FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "blocked_words_delete_admin"
  ON public.blocked_words FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "anti_spam_events_select_own_or_admin" ON public.anti_spam_events;
DROP POLICY IF EXISTS "anti_spam_events_insert_own" ON public.anti_spam_events;

CREATE POLICY "anti_spam_events_select_own_or_admin"
  ON public.anti_spam_events FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "anti_spam_events_insert_own"
  ON public.anti_spam_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "user_mutes_select_own" ON public.user_mutes;
DROP POLICY IF EXISTS "user_mutes_insert_own" ON public.user_mutes;
DROP POLICY IF EXISTS "user_mutes_delete_own" ON public.user_mutes;

CREATE POLICY "user_mutes_select_own"
  ON public.user_mutes FOR SELECT
  USING (auth.uid() = muter_user_id);

CREATE POLICY "user_mutes_insert_own"
  ON public.user_mutes FOR INSERT
  WITH CHECK (auth.uid() = muter_user_id);

CREATE POLICY "user_mutes_delete_own"
  ON public.user_mutes FOR DELETE
  USING (auth.uid() = muter_user_id);

DROP POLICY IF EXISTS "pronosticos_select_visible" ON public.pronosticos;
CREATE POLICY "pronosticos_select_visible"
  ON public.pronosticos
  FOR SELECT
  USING (
    public.can_view_pronostico(user_id, visibilidad)
    AND (
      moderation_status = 'approved'
      OR auth.uid() = user_id
      OR public.is_admin()
    )
    AND (
      auth.uid() = user_id
      OR public.is_admin()
      OR NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = pronosticos.user_id
          AND p.is_shadowbanned = true
      )
    )
  );

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
    AND (
      moderation_status = 'approved'
      OR auth.uid() = user_id
      OR public.is_admin()
    )
    AND (
      auth.uid() = user_id
      OR public.is_admin()
      OR NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = comentarios.user_id
          AND p.is_shadowbanned = true
      )
    )
  );
