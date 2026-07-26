ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS uq_agent_report_date;
ALTER TABLE daily_reports ADD COLUMN report_label VARCHAR(120);
CREATE INDEX idx_reports_agent_date_created ON daily_reports(agent_id, report_date DESC, created_at DESC);
