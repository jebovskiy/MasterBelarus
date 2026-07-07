CREATE TABLE IF NOT EXISTS cancel_rates (
  telegram_id BIGINT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION check_cancel_rate(p_telegram_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry cancel_rates%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_entry FROM cancel_rates WHERE telegram_id = p_telegram_id;

  IF NOT FOUND OR v_now - v_entry.window_start > INTERVAL '24 hours' THEN
    INSERT INTO cancel_rates (telegram_id, count, window_start)
    VALUES (p_telegram_id, 1, v_now)
    ON CONFLICT (telegram_id) DO UPDATE SET count = 1, window_start = v_now;
    RETURN jsonb_build_object('allowed', true, 'count', 1);
  END IF;

  v_entry.count := v_entry.count + 1;
  UPDATE cancel_rates SET count = v_entry.count WHERE telegram_id = p_telegram_id;

  IF v_entry.count > 3 THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_entry.count);
  ELSE
    RETURN jsonb_build_object('allowed', true, 'count', v_entry.count);
  END IF;
END;
$$;
