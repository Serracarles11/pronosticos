-- ============================================================
-- PULSO · Row Level Security
-- Ejecuta DESPUES de 01_schema.sql
-- ============================================================

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_likes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_predictions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges        ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own"    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"    ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- SPORTS / COMPETITIONS / EVENTS (lectura publica, escritura solo admin via service_role)
CREATE POLICY "sports_select_public"       ON public.sports       FOR SELECT USING (true);
CREATE POLICY "competitions_select_public" ON public.competitions FOR SELECT USING (true);
CREATE POLICY "events_select_public"       ON public.events       FOR SELECT USING (true);

-- PREDICTIONS
CREATE POLICY "predictions_select_public"
  ON public.predictions FOR SELECT
  USING (status != 'pending' OR auth.uid() = user_id OR true);  -- todas publicas por ahora

CREATE POLICY "predictions_insert_own"
  ON public.predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "predictions_update_own"
  ON public.predictions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "predictions_delete_own"
  ON public.predictions FOR DELETE
  USING (auth.uid() = user_id);

-- PREDICTION_LIKES
CREATE POLICY "likes_select_public" ON public.prediction_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own"    ON public.prediction_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own"    ON public.prediction_likes FOR DELETE USING (auth.uid() = user_id);

-- PREDICTION_COMMENTS
CREATE POLICY "comments_select_public" ON public.prediction_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own"    ON public.prediction_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_own"    ON public.prediction_comments FOR DELETE USING (auth.uid() = user_id);

-- FOLLOWS
CREATE POLICY "follows_select_public" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own"    ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own"    ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- SAVED_PREDICTIONS
CREATE POLICY "saved_select_own"  ON public.saved_predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_insert_own"  ON public.saved_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_delete_own"  ON public.saved_predictions FOR DELETE USING (auth.uid() = user_id);

-- BADGES
CREATE POLICY "badges_select_public"     ON public.badges      FOR SELECT USING (true);
CREATE POLICY "user_badges_select_public" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "user_badges_insert_own"   ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
