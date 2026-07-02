-- 009: profile extras — phone, city, description, radius_km (idempotent)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS radius_km    int NOT NULL DEFAULT 30;
