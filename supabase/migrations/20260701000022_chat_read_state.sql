-- Track last read timestamp per user per order for unread count
CREATE TABLE IF NOT EXISTS chat_read_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (order_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_read_state_order_profile ON chat_read_state (order_id, profile_id);

ALTER TABLE chat_read_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_read_state_select_policy ON chat_read_state
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY chat_read_state_insert_policy ON chat_read_state
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY chat_read_state_update_policy ON chat_read_state
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
