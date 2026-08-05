-- Pay periods.
--
-- Wages are settled roughly every thirty working days. Until now the payroll view could only
-- ask "what do the last N days look like right now", which is a moving window — the same
-- question asked a week later gives a different answer, so there was no way to say what was
-- actually paid for.
--
-- Closing a period freezes it: the totals are copied into payroll_period_lines and never
-- recomputed, and the next period starts the day after. That matters because a shift can
-- still be corrected afterwards; the correction belongs to the open period, not to money
-- already handed over.

CREATE TABLE payroll_periods (
    id            BIGSERIAL PRIMARY KEY,
    starts_on     DATE NOT NULL,
    ends_on       DATE NOT NULL,
    closed_at     TIMESTAMPTZ,
    closed_by_id  BIGINT REFERENCES app_users(id),
    note          VARCHAR(300),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_period_order CHECK (ends_on >= starts_on)
);

-- Exactly one period may be open at a time; two would make "the current period" ambiguous.
CREATE UNIQUE INDEX idx_payroll_one_open_period ON payroll_periods((closed_at IS NULL))
    WHERE closed_at IS NULL;
CREATE INDEX idx_payroll_periods_range ON payroll_periods(starts_on DESC);

-- One frozen line per person per closed period. Kept even if the person is later deactivated:
-- this is the record of what they were paid for.
CREATE TABLE payroll_period_lines (
    id                   BIGSERIAL PRIMARY KEY,
    period_id            BIGINT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    user_id              BIGINT NOT NULL REFERENCES app_users(id),
    display_name         VARCHAR(120) NOT NULL,   -- as it read at close; names change
    worked_minutes       BIGINT NOT NULL,
    days_present         INTEGER NOT NULL,
    expected_days        INTEGER NOT NULL,
    daily_target_minutes INTEGER NOT NULL,
    target_minutes       BIGINT NOT NULL,
    shifts               INTEGER NOT NULL,
    reports              BIGINT NOT NULL DEFAULT 0,
    contacted            BIGINT NOT NULL DEFAULT 0,
    ok_count             BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_period_user UNIQUE (period_id, user_id)
);

CREATE INDEX idx_period_lines_user ON payroll_period_lines(user_id);
