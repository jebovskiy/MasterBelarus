-- Partial GIST index: only open orders, dramatically smaller than full GIST
CREATE INDEX IF NOT EXISTS idx_orders_open_geo
  ON public.orders USING GIST (geo_location)
  WHERE status = 'open';

-- Composite index for /orders/my: client_id + created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_client_created
  ON public.orders (client_id, created_at DESC);

-- Composite index for bids listing by order: order_id + created_at
CREATE INDEX IF NOT EXISTS idx_bids_order_created
  ON public.bids (order_id, created_at ASC);

-- Index for notifications_log cleanup by sent_at
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at
  ON public.notifications_log (sent_at ASC);
