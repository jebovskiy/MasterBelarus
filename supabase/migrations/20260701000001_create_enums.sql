-- 001: Enum types for profiles and orders
CREATE TYPE public.user_role AS ENUM ('client', 'master');
CREATE TYPE public.order_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
