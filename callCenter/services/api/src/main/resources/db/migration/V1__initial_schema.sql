CREATE TABLE app_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role VARCHAR(24) NOT NULL,
  supervisor_id BIGINT REFERENCES app_users(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_reports (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES app_users(id),
  report_date DATE NOT NULL,
  total_people INTEGER NOT NULL DEFAULT 0 CHECK (total_people >= 0),
  contacted_count INTEGER NOT NULL DEFAULT 0 CHECK (contacted_count >= 0),
  ok_count INTEGER NOT NULL DEFAULT 0 CHECK (ok_count >= 0),
  maybe_count INTEGER NOT NULL DEFAULT 0 CHECK (maybe_count >= 0),
  no_count INTEGER NOT NULL DEFAULT 0 CHECK (no_count >= 0),
  no_answer_count INTEGER NOT NULL DEFAULT 0 CHECK (no_answer_count >= 0),
  notes VARCHAR(1000),
  status VARCHAR(32) NOT NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_id BIGINT REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_agent_report_date UNIQUE (agent_id, report_date)
);

CREATE INDEX idx_reports_date_status ON daily_reports(report_date, status);
CREATE INDEX idx_reports_agent ON daily_reports(agent_id);

CREATE TABLE report_revisions (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES daily_reports(id),
  actor_id BIGINT NOT NULL REFERENCES app_users(id),
  reason VARCHAR(1000) NOT NULL,
  old_values TEXT NOT NULL,
  new_values TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT REFERENCES app_users(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80),
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_created ON audit_events(created_at DESC);
