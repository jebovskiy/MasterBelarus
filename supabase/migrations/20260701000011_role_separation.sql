-- 011: role separation — is_master, current_role, master_status (idempotent)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_master      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_role   text    NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS master_status  text    NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_profiles_master_status ON public.profiles (master_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_master     ON public.profiles (is_master);
