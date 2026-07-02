-- 012: add category column to profiles for pending master application

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS category text;
