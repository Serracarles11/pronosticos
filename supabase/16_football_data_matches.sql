-- ============================================================
-- TodosGanamos - Partidos football-data.org
-- Ejecutar en Supabase SQL Editor despues de 15_anti_spam.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.football_matches (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id            TEXT        UNIQUE NOT NULL,
  provider               TEXT        NOT NULL DEFAULT 'football-data.org',
  competition_code       TEXT,
  competition_name       TEXT,
  competition_emblem     TEXT,
  home_team_id           TEXT,
  home_team_name         TEXT        NOT NULL,
  home_team_short_name   TEXT,
  home_team_crest        TEXT,
  away_team_id           TEXT,
  away_team_name         TEXT        NOT NULL,
  away_team_short_name   TEXT,
  away_team_crest        TEXT,
  kickoff_at             TIMESTAMPTZ NOT NULL,
  status                 TEXT        NOT NULL,
  matchday               INTEGER,
  stage                  TEXT,
  group_name             TEXT,
  home_score             INTEGER,
  away_score             INTEGER,
  winner                 TEXT,
  last_updated_provider  TIMESTAMPTZ,
  raw_json               JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.football_data_sync_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status       TEXT        NOT NULL,
  fetched      INTEGER     NOT NULL DEFAULT 0,
  inserted     INTEGER     NOT NULL DEFAULT 0,
  updated      INTEGER     NOT NULL DEFAULT 0,
  skipped      INTEGER     NOT NULL DEFAULT 0,
  errors_json  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pronosticos
  ADD COLUMN IF NOT EXISTS football_match_id UUID REFERENCES public.football_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS football_match_external_id TEXT;

DROP TRIGGER IF EXISTS football_matches_updated_at ON public.football_matches;
CREATE TRIGGER football_matches_updated_at
  BEFORE UPDATE ON public.football_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_football_matches_external_id
  ON public.football_matches(external_id);
CREATE INDEX IF NOT EXISTS idx_football_matches_kickoff_at
  ON public.football_matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_football_matches_status
  ON public.football_matches(status);
CREATE INDEX IF NOT EXISTS idx_football_matches_competition_code
  ON public.football_matches(competition_code);
CREATE INDEX IF NOT EXISTS idx_football_matches_home_team_name
  ON public.football_matches USING gin (home_team_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_football_matches_away_team_name
  ON public.football_matches USING gin (away_team_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_football_matches_competition_kickoff
  ON public.football_matches(competition_code, kickoff_at);
CREATE INDEX IF NOT EXISTS idx_football_data_sync_logs_created_at
  ON public.football_data_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pronosticos_football_match_id
  ON public.pronosticos(football_match_id);

ALTER TABLE public.football_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_data_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "football_matches_select_public" ON public.football_matches;
DROP POLICY IF EXISTS "football_matches_insert_admin" ON public.football_matches;
DROP POLICY IF EXISTS "football_matches_update_admin" ON public.football_matches;
DROP POLICY IF EXISTS "football_matches_delete_admin" ON public.football_matches;

CREATE POLICY "football_matches_select_public"
  ON public.football_matches FOR SELECT
  USING (true);

CREATE POLICY "football_matches_insert_admin"
  ON public.football_matches FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "football_matches_update_admin"
  ON public.football_matches FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "football_matches_delete_admin"
  ON public.football_matches FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "football_sync_logs_select_admin" ON public.football_data_sync_logs;
DROP POLICY IF EXISTS "football_sync_logs_insert_admin" ON public.football_data_sync_logs;

CREATE POLICY "football_sync_logs_select_admin"
  ON public.football_data_sync_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "football_sync_logs_insert_admin"
  ON public.football_data_sync_logs FOR INSERT
  WITH CHECK (public.is_admin());
