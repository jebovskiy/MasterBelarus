-- 021: add status column to bids (pending → accepted once client picks the master)

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_bids_status ON public.bids (order_id, status);

-- Update existing in_progress orders: mark the winning bid as accepted
UPDATE public.bids b
SET status = 'accepted'
FROM public.orders o
WHERE o.id = b.order_id
  AND o.status IN ('in_progress', 'completed')
  AND b.status = 'pending';
