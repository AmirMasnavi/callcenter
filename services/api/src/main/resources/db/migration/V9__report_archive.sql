-- Archiving: list hygiene, NOT deletion.
--
-- Distinct from voiding on purpose:
--   voided   = the report is wrong, and is excluded from every statistic
--   archived = the report is finished with, and only leaves the working lists
--
-- Archived reports therefore still count in the dashboard and exports. Without this,
-- archiving to tidy a queue would silently change the manager's numbers.

ALTER TABLE daily_reports ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE daily_reports ADD COLUMN archived_by BIGINT REFERENCES app_users(id);

-- Working lists filter on this, so index the live rows.
CREATE INDEX idx_reports_not_archived ON daily_reports(submitted_at DESC)
  WHERE archived_at IS NULL AND voided_at IS NULL;

CREATE INDEX idx_reports_archived ON daily_reports(archived_at DESC)
  WHERE archived_at IS NOT NULL;
