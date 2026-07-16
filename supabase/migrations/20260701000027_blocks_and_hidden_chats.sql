-- Blocked users: who blocked whom
CREATE TABLE blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked ON blocked_users(blocked_id);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own blocks" ON blocked_users
  FOR SELECT USING (blocker_id = auth.uid());

CREATE POLICY "Users can insert own blocks" ON blocked_users
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can delete own blocks" ON blocked_users
  FOR DELETE USING (blocker_id = auth.uid());


-- Hidden chats: per-user conversation hiding
CREATE TABLE hidden_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, order_id)
);

CREATE INDEX idx_hidden_chats_profile ON hidden_chats(profile_id);

ALTER TABLE hidden_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own hidden chats" ON hidden_chats
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own hidden chats" ON hidden_chats
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own hidden chats" ON hidden_chats
  FOR DELETE USING (profile_id = auth.uid());
