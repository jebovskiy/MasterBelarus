-- Link profiles to Supabase Auth users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id uuid references auth.users(id);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);

-- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = auth_user_id);
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- RLS: orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_owner_all" ON public.orders;
CREATE POLICY "orders_owner_all" ON public.orders
  FOR ALL USING (
    client_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "orders_masters_view_open" ON public.orders;
CREATE POLICY "orders_masters_view_open" ON public.orders
  FOR SELECT USING (
    status = 'open'
    AND
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND is_master = true)
  );
DROP POLICY IF EXISTS "orders_assigned_master_view" ON public.orders;
CREATE POLICY "orders_assigned_master_view" ON public.orders
  FOR SELECT USING (
    id IN (SELECT order_id FROM bids WHERE master_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()))
  );

-- RLS: bids
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bids_owner_select" ON public.bids;
CREATE POLICY "bids_owner_select" ON public.bids
  FOR SELECT USING (
    master_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR
    order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()))
  );
DROP POLICY IF EXISTS "bids_master_insert" ON public.bids;
CREATE POLICY "bids_master_insert" ON public.bids
  FOR INSERT WITH CHECK (
    master_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid() AND is_master = true)
  );

-- RLS: reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_owner_select" ON public.reviews;
CREATE POLICY "reviews_owner_select" ON public.reviews
  FOR SELECT USING (
    client_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR
    master_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "reviews_client_insert" ON public.reviews;
CREATE POLICY "reviews_client_insert" ON public.reviews
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

-- RLS: master_categories
ALTER TABLE public.master_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mc_master_all" ON public.master_categories;
CREATE POLICY "mc_master_all" ON public.master_categories
  FOR ALL USING (
    master_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

-- RLS: master_balances
ALTER TABLE public.master_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mb_master_select" ON public.master_balances;
CREATE POLICY "mb_master_select" ON public.master_balances
  FOR SELECT USING (
    master_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "mb_admin_all" ON public.master_balances
  FOR ALL USING (
    auth.role() = 'service_role'
  );

-- RLS: complaints
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "complaints_insert" ON public.complaints;
CREATE POLICY "complaints_insert" ON public.complaints
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "complaints_admin_all" ON public.complaints
  FOR ALL USING (
    auth.role() = 'service_role'
  );

-- RLS: notifications_log
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_owner_select" ON public.notifications_log;
CREATE POLICY "notif_owner_select" ON public.notifications_log
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "notif_admin_all" ON public.notifications_log
  FOR ALL USING (
    auth.role() = 'service_role'
  );
