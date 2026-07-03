-- 013: complaints table for admin moderation

CREATE TABLE IF NOT EXISTS public.complaints (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name  TEXT NOT NULL,
  user_role  TEXT NOT NULL DEFAULT 'customer',
  text       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);
