-- 004: bids table (master responses to orders)
CREATE TABLE public.bids (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  master_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_price numeric,
  comment        text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (order_id, master_id)
);

CREATE INDEX idx_bids_order_id  ON public.bids (order_id);
CREATE INDEX idx_bids_master_id ON public.bids (master_id);

-- RLS
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Client who owns the order can see all bids for it
CREATE POLICY bids_select ON public.bids
  FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE client_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint))
    OR
    master_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint)
  );

-- Masters can insert bids on open orders (service role handles the actual insert after balance check)
CREATE POLICY bids_insert ON public.bids
  FOR INSERT WITH CHECK (master_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));
