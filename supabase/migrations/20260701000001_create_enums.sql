-- 001: Enum types for profiles and orders (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'user_role' AND n.nspname = 'public') THEN
    CREATE TYPE public.user_role AS ENUM ('client', 'master');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'order_status' AND n.nspname = 'public') THEN
    CREATE TYPE public.order_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
  END IF;
END $$;
