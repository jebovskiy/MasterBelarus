-- 005: master_categories (idempotent)
CREATE TABLE IF NOT EXISTS public.master_categories (
  master_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category  text NOT NULL,
  PRIMARY KEY (master_id, category)
);

CREATE INDEX IF NOT EXISTS idx_mc_master_id ON public.master_categories (master_id);
CREATE INDEX IF NOT EXISTS idx_mc_category   ON public.master_categories (category);

ALTER TABLE public.master_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mc_select ON public.master_categories;
CREATE POLICY mc_select ON public.master_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS mc_insert ON public.master_categories;
CREATE POLICY mc_insert ON public.master_categories
  FOR INSERT WITH CHECK (master_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));

DROP POLICY IF EXISTS mc_delete ON public.master_categories;
CREATE POLICY mc_delete ON public.master_categories
  FOR DELETE USING (master_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));
