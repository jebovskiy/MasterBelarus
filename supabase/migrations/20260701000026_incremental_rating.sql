-- Replace full-scan AVG trigger with incremental update
-- O(N) → O(1) per new review

CREATE OR REPLACE FUNCTION public.trg_recalc_master_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET
    avg_rating   = ROUND((COALESCE(avg_rating * review_count, 0) + NEW.rating)::numeric / (COALESCE(review_count, 0) + 1), 1),
    review_count = COALESCE(review_count, 0) + 1
  WHERE id = NEW.master_id;

  RETURN NEW;
END;
$$;
