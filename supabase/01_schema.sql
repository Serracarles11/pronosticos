-- ============================================================
-- TodosGanamos · Schema completo ejecutable
-- Ejecuta este archivo DESPUES de 00_types.sql
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- TABLA: profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username         VARCHAR       NOT NULL UNIQUE
                                 CHECK (char_length(username) >= 3),
  display_name     VARCHAR,
  avatar_url       TEXT,
  bio              TEXT,
  total_likes      INTEGER       NOT NULL DEFAULT 0,
  followers_count  INTEGER       NOT NULL DEFAULT 0,
  following_count  INTEGER       NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA: sports
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sports (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR   NOT NULL,
  slug        VARCHAR   NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA: competitions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitions (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id    UUID      NOT NULL REFERENCES public.sports(id),
  name        VARCHAR   NOT NULL,
  slug        VARCHAR   NOT NULL,
  country     VARCHAR,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA: events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id        UUID          NOT NULL REFERENCES public.sports(id),
  competition_id  UUID          REFERENCES public.competitions(id),
  home_team       VARCHAR,
  away_team       VARCHAR,
  event_name      VARCHAR,
  starts_at       TIMESTAMPTZ   NOT NULL,
  status          event_status  NOT NULL DEFAULT 'scheduled',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA: predictions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.predictions (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_id        UUID              NOT NULL REFERENCES public.sports(id),
  competition_id  UUID              REFERENCES public.competitions(id),
  event_id        UUID              REFERENCES public.events(id),
  title           VARCHAR           NOT NULL,
  pick            VARCHAR           NOT NULL,
  odds            NUMERIC           NOT NULL CHECK (odds >= 1.01),
  stake           INTEGER           NOT NULL DEFAULT 1 CHECK (stake >= 1 AND stake <= 10),
  explanation     TEXT,
  status          prediction_status NOT NULL DEFAULT 'pending',
  likes_count     INTEGER           NOT NULL DEFAULT 0,
  comments_count  INTEGER           NOT NULL DEFAULT 0,
  profit          NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN status = 'won'  THEN ROUND((odds - 1) * stake, 2)
      WHEN status = 'lost' THEN -stake::NUMERIC
      ELSE 0
    END
  ) STORED,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA: prediction_likes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prediction_likes (
  prediction_id  UUID  NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id        UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (prediction_id, user_id)
);

-- ------------------------------------------------------------
-- TABLA: prediction_comments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prediction_comments (
  id             UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id  UUID      NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id        UUID      NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body           TEXT      NOT NULL CHECK (char_length(TRIM(body)) > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA: follows
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

-- ------------------------------------------------------------
-- TABLA: saved_predictions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_predictions (
  prediction_id  UUID  NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id        UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (prediction_id, user_id)
);

-- ------------------------------------------------------------
-- TABLA: badges
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badges (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR NOT NULL,
  slug        VARCHAR NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA: user_badges
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id    UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id   UUID  NOT NULL REFERENCES public.badges(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- ------------------------------------------------------------
-- INDICES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_predictions_user_id    ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_sport_id   ON public.predictions(sport_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON public.predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_status     ON public.predictions(status);
CREATE INDEX IF NOT EXISTS idx_pred_likes_user        ON public.prediction_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_pred_comments_pred     ON public.prediction_comments(prediction_id);
CREATE INDEX IF NOT EXISTS idx_follows_following      ON public.follows(following_id);
