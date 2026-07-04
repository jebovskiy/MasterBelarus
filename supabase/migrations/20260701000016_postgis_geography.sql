-- Fix PostGIS: geometry → geography so ST_DWithin uses meters, not degrees
-- Also move city filter INTO the RPC to avoid in-memory filtering in Node.js

DROP INDEX IF EXISTS idx_orders_geo;
DROP INDEX IF EXISTS idx_orders_open_geo;

ALTER TABLE public.orders
  ALTER COLUMN geo_location TYPE geography(Point, 4326)
  USING geo_location::geography;

-- Recreate indexes for geography
CREATE INDEX IF NOT EXISTS idx_orders_geo
  ON public.orders USING GIST (geo_location);

CREATE INDEX IF NOT EXISTS idx_orders_open_geo
  ON public.orders USING GIST (geo_location)
  WHERE status = 'open';

-- Drop and recreate RPC with geography + optional city filter
DROP FUNCTION IF EXISTS public.find_orders_nearby;

CREATE OR REPLACE FUNCTION public.find_orders_nearby(
  p_lat       double precision,
  p_lng       double precision,
  p_radius    int DEFAULT 5000,
  p_category  text DEFAULT NULL,
  p_city      text DEFAULT NULL
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
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::double precision AS distance_m
  FROM public.orders o
  WHERE o.status = 'open'
    AND o.geo_location IS NOT NULL
    AND ST_DWithin(
      o.geo_location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius
    )
    AND (p_category IS NULL OR o.category = p_category)
    AND (p_city IS NULL OR o.address_text LIKE 'г. ' || p_city || '%')
  ORDER BY distance_m ASC;
$$;
