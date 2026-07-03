-- 014: order cancellation fields + suspicious flag on profiles

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_by            text,
  ADD COLUMN IF NOT EXISTS cancellation_reason_id   int,
  ADD COLUMN IF NOT EXISTS cancellation_reason_text text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspicious boolean NOT NULL DEFAULT false;
