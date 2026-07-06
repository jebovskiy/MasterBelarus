-- Track last read timestamp per user per order for unread count
CREATE TABLE IF NOT EXISTS chat_read_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (order_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_read_state_order_profile ON chat_read_state (order_id, profile_id);
