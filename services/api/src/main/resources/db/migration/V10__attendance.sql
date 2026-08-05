-- Attendance (ورود و خروج) — the paper timesheet, one row per shift.
--
-- Several rows per person per day are allowed on purpose: someone can leave at noon and
-- come back in the afternoon, and each pair is its own record. The day's total is the sum
-- of its shifts, which is also why worked minutes are DERIVED rather than stored — a
-- stored duration would silently disagree with the times after any correction.
--
-- exit_at is nullable: an open shift is someone who is currently in the building.

CREATE TABLE attendance_entries (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT      NOT NULL REFERENCES app_users(id),
  entry_at     TIMESTAMPTZ NOT NULL,
  exit_at      TIMESTAMPTZ,
  recorded_by  BIGINT      NOT NULL REFERENCES app_users(id),
  note         VARCHAR(300),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_exit_after_entry CHECK (exit_at IS NULL OR exit_at > entry_at)
);

CREATE INDEX idx_attendance_user_entry ON attendance_entries(user_id, entry_at DESC);
CREATE INDEX idx_attendance_entry_at ON attendance_entries(entry_at DESC);
-- At most one shift open per person; a second clock-in without clocking out is a mistake.
CREATE UNIQUE INDEX idx_attendance_one_open_shift ON attendance_entries(user_id) WHERE exit_at IS NULL;

-- Monthly target, per person. NULL means "use the system default", so changing the default
-- moves everyone who has not been given a specific figure.
ALTER TABLE app_users ADD COLUMN monthly_hours_target INTEGER
  CHECK (monthly_hours_target IS NULL OR monthly_hours_target > 0);

INSERT INTO app_settings (key, value) VALUES ('attendance.default-monthly-hours', '150');
