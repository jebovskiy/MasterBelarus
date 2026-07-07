CREATE OR REPLACE FUNCTION update_master_categories(p_master_id UUID, p_categories TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM master_categories WHERE master_id = p_master_id;
  IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 0 THEN
    INSERT INTO master_categories (master_id, category)
    SELECT p_master_id, unnest(p_categories);
  END IF;
END;
$$;
