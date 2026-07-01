-- 005: master_categories (many-to-many)
CREATE TABLE public.master_categories (
  master_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category  text NOT NULL,
  PRIMARY KEY (master_id, category)
);

CREATE INDEX idx_mc_master_id ON public.master_categories (master_id);
CREATE INDEX idx_mc_category   ON public.master_categories (category);

-- RLS
ALTER TABLE public.master_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY mc_select ON public.master_categories
  FOR SELECT USING (true);

CREATE POLICY mc_insert ON public.master_categories
  FOR INSERT WITH CHECK (master_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));

CREATE POLICY mc_delete ON public.master_categories
  FOR DELETE USING (master_id = (SELECT id FROM public.profiles WHERE telegram_id = current_setting('request.jwt.claims')::bigint));
