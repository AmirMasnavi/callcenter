-- The target is per DAY, not per month.
--
-- A monthly figure only answers the question at the end of the month. Asking "have they put
-- in five hours a day?" over any window — ten days, fifteen, thirty — needs a daily rate that
-- the period target is derived from: expected working days × the daily rate. 30 × 5h is the
-- same 150 hours as before, so nothing about a full pay period changes; every shorter window
-- now has an honest target instead of being measured against a month it cannot reach.
--
-- Stored in MINUTES, like every other duration in this schema, so the arithmetic never leaves
-- integers.

ALTER TABLE app_users ADD COLUMN daily_target_minutes INTEGER
  CHECK (daily_target_minutes IS NULL OR daily_target_minutes > 0);

COMMENT ON COLUMN app_users.daily_target_minutes IS
  'Expected worked minutes per working day. NULL means use attendance.daily-target-minutes.';

-- Carry over anyone who had been given a specific monthly figure: 30 working days a month.
UPDATE app_users
   SET daily_target_minutes = GREATEST(1, ROUND(monthly_hours_target * 60.0 / 30))
 WHERE monthly_hours_target IS NOT NULL;

ALTER TABLE app_users DROP COLUMN monthly_hours_target;

INSERT INTO app_settings (key, value) VALUES ('attendance.daily-target-minutes', '300')
  ON CONFLICT (key) DO NOTHING;

DELETE FROM app_settings WHERE key = 'attendance.default-monthly-hours';
