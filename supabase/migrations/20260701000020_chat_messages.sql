-- Chat messages between client and master on an active order

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 2000),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by order
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON messages (order_id, created_at ASC);

-- Enable Realtime for this table (used by the Mini App)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Row-Level Security: participants can read messages for their orders
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_policy ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = messages.order_id
        AND (
          o.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM bids b
            WHERE b.order_id = o.id AND b.master_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY messages_insert_policy ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_id
          AND (
            o.client_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM bids b
              WHERE b.order_id = o.id AND b.master_id = auth.uid()
            )
          )
      )
    )
  );
