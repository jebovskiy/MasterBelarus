-- 002: profiles table + RLS (idempotent)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint  NOT NULL UNIQUE,
  username    text,
  full_name   text,
  role        public.user_role NOT NULL DEFAULT 'client',
  is_npd      boolean NOT NULL DEFAULT false,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles (telegram_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles (role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (telegram_id = current_setting('request.jwt.claims')::bigint);
