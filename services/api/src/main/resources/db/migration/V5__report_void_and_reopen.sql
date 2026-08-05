-- Admin powers: voiding (soft-delete) and reopening reports.
-- Voided reports stay in the table so the audit trail and revision history survive.

ALTER TABLE daily_reports ADD COLUMN voided_at   TIMESTAMPTZ;
ALTER TABLE daily_reports ADD COLUMN voided_by   BIGINT REFERENCES app_users(id);
ALTER TABLE daily_reports ADD COLUMN void_reason VARCHAR(1000);

-- Almost every read filters voided rows out, so index the live ones.
CREATE INDEX idx_reports_not_voided ON daily_reports(report_date DESC) WHERE voided_at IS NULL;
