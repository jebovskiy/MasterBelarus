-- 007: reviews table (idempotent)
CREATE TABLE IF NOT EXISTS public.reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES public.profiles(id),
  master_id  uuid NOT NULL REFERENCES public.profiles(id),
  rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_master_id ON public.reviews (master_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON public.reviews (client_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_select ON public.reviews;
CREATE POLICY reviews_select ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS reviews_insert ON public.reviews;
CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT WITH CHECK (client_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));

-- Add denormalized rating columns to profiles (idempotent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avg_rating numeric(2,1) DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS review_count int DEFAULT 0;

CREATE OR REPLACE FUNCTION public.trg_recalc_master_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  avg_val numeric;
  cnt_val int;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)
  INTO avg_val, cnt_val
  FROM public.reviews
  WHERE master_id = NEW.master_id;

  UPDATE public.profiles
  SET avg_rating   = avg_val,
      review_count = cnt_val
  WHERE id = NEW.master_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_after_insert ON public.reviews;
CREATE TRIGGER trg_reviews_after_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recalc_master_rating();
