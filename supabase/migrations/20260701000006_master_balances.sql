-- 006: master_balances (response credits)
CREATE TABLE public.master_balances (
  master_id      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  response_credits int NOT NULL DEFAULT 20,
  total_purchased int NOT NULL DEFAULT 0,
  total_spent      int NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.master_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY mb_select ON public.master_balances
  FOR SELECT USING (master_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));

-- Atomic deduction: atomically decrements response_credits if > 0
-- Returns true on success, false if insufficient credits.
CREATE OR REPLACE FUNCTION public.deduct_response(p_master_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  updated boolean;
BEGIN
  UPDATE public.master_balances
  SET response_credits = response_credits - 1,
      total_spent      = total_spent + 1,
      updated_at       = now()
  WHERE master_id = p_master_id
    AND response_credits > 0;

  updated := FOUND;

  IF NOT updated THEN
    -- Auto-create row with welcome credits if missing
    INSERT INTO public.master_balances (master_id, response_credits)
    VALUES (p_master_id, 19)
    ON CONFLICT (master_id) DO NOTHING;
    updated := FOUND;
  END IF;

  RETURN updated;
END;
$$;

-- Auto-create balance row when a profile with role='master' is inserted
CREATE OR REPLACE FUNCTION public trg_create_master_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'master' THEN
    INSERT INTO public.master_balances (master_id, response_credits)
    VALUES (NEW.id, 20)
    ON CONFLICT (master_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_after_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_create_master_balance();
