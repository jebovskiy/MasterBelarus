-- 003: orders table + PostGIS (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category      text NOT NULL,
  description   text NOT NULL,
  price         numeric,
  is_negotiable boolean NOT NULL DEFAULT false,
  geo_location  geometry(Point, 4326),
  address_text  text,
  status        public.order_status NOT NULL DEFAULT 'open',
  images        text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders (client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_category   ON public.orders (category);
CREATE INDEX IF NOT EXISTS idx_orders_geo        ON public.orders USING gist (geo_location);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select ON public.orders;
CREATE POLICY orders_select ON public.orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders
  FOR UPDATE USING (client_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));

DROP POLICY IF EXISTS orders_insert ON public.orders;
CREATE POLICY orders_insert ON public.orders
  FOR INSERT WITH CHECK (client_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));
