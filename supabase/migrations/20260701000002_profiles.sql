-- 002: profiles table + RLS
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint  NOT NULL UNIQUE,
  username    text,
  full_name   text,
  role        public.user_role NOT NULL DEFAULT 'client',
  is_npd      boolean NOT NULL DEFAULT false,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_telegram_id ON public.profiles (telegram_id);
CREATE INDEX idx_profiles_role        ON public.profiles (role);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for master cards visible to clients)
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (true);

-- Users can update only their own row
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (telegram_id = current_setting('request.jwt.claims')::bigint);

-- Service role does everything (via SUPABASE_SERVICE_ROLE_KEY bypasses RLS)
