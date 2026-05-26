-- ============================================================
-- PULSO · Datos iniciales: deportes y competiciones
-- Ejecuta DESPUES de 03_triggers.sql
-- ============================================================

-- Deportes base
INSERT INTO public.sports (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Futbol',    'football'),
  ('00000000-0000-0000-0000-000000000002', 'Tenis',     'tennis'),
  ('00000000-0000-0000-0000-000000000003', 'NBA',       'basketball'),
  ('00000000-0000-0000-0000-000000000004', 'eSports',   'esports'),
  ('00000000-0000-0000-0000-000000000005', 'Combinada', 'parlay'),
  ('00000000-0000-0000-0000-000000000006', 'Otros',     'other')
ON CONFLICT (slug) DO NOTHING;

-- Competiciones de Futbol
INSERT INTO public.competitions (sport_id, name, slug, country) VALUES
  ('00000000-0000-0000-0000-000000000001', 'LaLiga',           'laliga',           'ESP'),
  ('00000000-0000-0000-0000-000000000001', 'Premier League',   'premier-league',   'ENG'),
  ('00000000-0000-0000-0000-000000000001', 'Champions League', 'champions-league', NULL),
  ('00000000-0000-0000-0000-000000000001', 'Liga Hypermotion', 'liga-hypermotion', 'ESP'),
  ('00000000-0000-0000-0000-000000000001', 'Copa del Rey',     'copa-del-rey',     'ESP'),
  ('00000000-0000-0000-0000-000000000001', 'Bundesliga',       'bundesliga',       'GER'),
  ('00000000-0000-0000-0000-000000000001', 'Serie A',          'serie-a',          'ITA')
ON CONFLICT DO NOTHING;

-- Competiciones de Tenis
INSERT INTO public.competitions (sport_id, name, slug, country) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Roland Garros', 'roland-garros', NULL),
  ('00000000-0000-0000-0000-000000000002', 'Wimbledon',     'wimbledon',     'ENG'),
  ('00000000-0000-0000-0000-000000000002', 'US Open',       'us-open',       'USA'),
  ('00000000-0000-0000-0000-000000000002', 'Australian Open', 'australian-open', 'AUS')
ON CONFLICT DO NOTHING;

-- Competiciones de NBA
INSERT INTO public.competitions (sport_id, name, slug, country) VALUES
  ('00000000-0000-0000-0000-000000000003', 'NBA Regular Season', 'nba-regular',  'USA'),
  ('00000000-0000-0000-0000-000000000003', 'NBA Playoffs',       'nba-playoffs', 'USA'),
  ('00000000-0000-0000-0000-000000000003', 'NBA Finals',         'nba-finals',   'USA')
ON CONFLICT DO NOTHING;

-- Badges basicos
INSERT INTO public.badges (name, slug, description) VALUES
  ('Top Tipster',   'top-tipster',   'Entre los mejores tipsters de la semana'),
  ('Racha x5',      'streak-5',      '5 predicciones acertadas seguidas'),
  ('Racha x10',     'streak-10',     '10 predicciones acertadas seguidas'),
  ('Verificado',    'verified',      'Identidad verificada'),
  ('Experto Futbol','expert-football','Mas del 70% de acierto en Futbol'),
  ('100 Picks',     '100-picks',     'Ha publicado 100 pronosticos')
ON CONFLICT (slug) DO NOTHING;
