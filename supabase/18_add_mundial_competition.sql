-- ============================================================
-- TodosGanamos - Competicion Mundial
-- Ejecutar en Supabase SQL Editor despues de 04_seed_sports.sql
-- ============================================================

INSERT INTO public.competitions (sport_id, name, slug, country)
VALUES ('00000000-0000-0000-0000-000000000001', 'Mundial', 'mundial', NULL)
ON CONFLICT DO NOTHING;
