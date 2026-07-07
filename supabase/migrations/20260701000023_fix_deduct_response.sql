-- 023: Fix deduct_response — no phantom credits, lazy init on first bid

CREATE OR REPLACE FUNCTION public.deduct_response(p_master_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  updated boolean;
BEGIN
  -- Try to deduct 1 credit (only if credits > 0 AND row exists)
  UPDATE public.master_balances
  SET response_credits = response_credits - 1,
      total_spent      = total_spent + 1,
      updated_at       = now()
  WHERE master_id = p_master_id
    AND response_credits > 0;

  IF FOUND THEN RETURN TRUE; END IF;

  -- Row exists but credits = 0 → insufficient
  IF EXISTS (SELECT 1 FROM public.master_balances WHERE master_id = p_master_id) THEN
    RETURN FALSE;
  END IF;

  -- Row doesn't exist → lazy init with 20, then deduct 1
  INSERT INTO public.master_balances (master_id, response_credits)
  VALUES (p_master_id, 20)
  ON CONFLICT (master_id) DO NOTHING;

  UPDATE public.master_balances
  SET response_credits = response_credits - 1,
      total_spent      = total_spent + 1,
      updated_at       = now()
  WHERE master_id = p_master_id
    AND response_credits > 0;

  RETURN FOUND;
END;
$$;

-- Also fix the trigger to fire on master approval
DROP TRIGGER IF EXISTS trg_profiles_after_insert ON public.profiles;
DROP FUNCTION IF EXISTS public.trg_create_master_balance();

CREATE OR REPLACE FUNCTION public.trg_init_master_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.master_status = 'approved' AND (OLD.master_status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.master_balances (master_id, response_credits)
    VALUES (NEW.id, 20)
    ON CONFLICT (master_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_after_approve
  AFTER UPDATE OF master_status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_init_master_balance();
