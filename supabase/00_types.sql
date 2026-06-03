-- ============================================================
-- TodosGanamos · Tipos (enums)
-- Ejecuta este archivo PRIMERO
-- ============================================================

-- Estado de una prediccion
DO $$ BEGIN
  CREATE TYPE prediction_status AS ENUM ('pending', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estado de un evento
DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('scheduled', 'live', 'finished', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
