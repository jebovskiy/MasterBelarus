-- 008: notifications_log + RPC find_orders_nearby + storage bucket (idempotent)
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   bigint NOT NULL,
  type          text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  sent_at       timestamptz NOT NULL DEFAULT now(),
  error         text
);

CREATE INDEX IF NOT EXISTS idx_nl_telegram_id ON public.notifications_log (telegram_id);
CREATE INDEX IF NOT EXISTS idx_nl_sent_at     ON public.notifications_log (sent_at);

CREATE OR REPLACE FUNCTION public.find_orders_nearby(
  p_lat     double precision,
  p_lng     double precision,
  p_radius  int DEFAULT 5000,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  client_id    uuid,
  category     text,
  description  text,
  price        numeric,
  is_negotiable boolean,
  address_text text,
  status       public.order_status,
  images       text[],
  created_at   timestamptz,
  distance_m   double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.id,
    o.client_id,
    o.category,
    o.description,
    o.price,
    o.is_negotiable,
    o.address_text,
    o.status,
    o.images,
    o.created_at,
    ST_Distance(
      o.geo_location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    )::double precision AS distance_m
  FROM public.orders o
  WHERE o.status = 'open'
    AND o.geo_location IS NOT NULL
    AND ST_DWithin(
      o.geo_location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
      p_radius
    )
    AND (p_category IS NULL OR o.category = p_category)
  ORDER BY distance_m ASC;
$$;

-- Storage bucket for order images
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-images', 'order-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_order_images_select ON storage.objects;
CREATE POLICY storage_order_images_select ON storage.objects
  FOR SELECT USING (bucket_id = 'order-images');

DROP POLICY IF EXISTS storage_order_images_insert ON storage.objects;
CREATE POLICY storage_order_images_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'order-images' AND auth.role() = 'authenticated');
