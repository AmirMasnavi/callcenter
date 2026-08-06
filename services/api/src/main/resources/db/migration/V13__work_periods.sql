-- Periods belong to a PERSON and are counted in attendance days, not calendar dates.
--
-- V12 modelled one shared cycle over a date range. That was wrong: these are project workers
-- who are paid per 30 days they actually turn up, however long that takes — someone may
-- spread 30 attendance days across four months. One person's cycle can end today and
-- another's next month, so there is no such thing as "the current period" for the office.
--
-- V12 never reached production, so its tables are dropped rather than migrated; there is no
-- settled payroll data to preserve.

DROP TABLE IF EXISTS payroll_period_lines;
DROP TABLE IF EXISTS payroll_periods;

CREATE TABLE work_periods (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES app_users(id),
    seq           INTEGER NOT NULL,          -- 1, 2, 3… per person, for display
    started_on    DATE NOT NULL,
    -- Null while running. Set at close; days are counted within [started_on, ended_on].
    ended_on      DATE,

    -- Attendance days this period is worth. Per person, because the arrangement differs.
    target_days   INTEGER NOT NULL DEFAULT 30 CHECK (target_days > 0),

    -- Hours owed from the previous period, when the manager chose to carry a shortfall
    -- forward. Added to this period's target, so the debt is paid off by working it.
    carried_over_minutes BIGINT NOT NULL DEFAULT 0,

    closed_at     TIMESTAMPTZ,
    closed_by_id  BIGINT REFERENCES app_users(id),
    note          VARCHAR(300),

    -- How an hours shortfall was resolved at close. Null while open.
    --   CARRY_OVER — the deficit moves into the next period's target
    --   EXTEND     — the period was held open for extra days (recorded once finally closed)
    --   FORGIVE    — written off; the next period starts clean
    settlement    VARCHAR(16),

    -- Frozen at close. Attendance stays correctable forever, so recomputing a settled period
    -- would change what somebody was already paid.
    final_worked_minutes BIGINT,
    final_target_minutes BIGINT,
    final_days           INTEGER,
    final_shifts         INTEGER,
    final_reports        BIGINT,
    final_contacted      BIGINT,
    final_ok             BIGINT,
    final_attendees      BIGINT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_period_dates CHECK (ended_on IS NULL OR ended_on >= started_on),
    CONSTRAINT chk_settlement CHECK (settlement IS NULL
        OR settlement IN ('CARRY_OVER', 'EXTEND', 'FORGIVE')),
    -- A closed period must carry its figures; an open one must not pretend to have them.
    CONSTRAINT chk_closed_is_frozen CHECK (
        (closed_at IS NULL AND final_worked_minutes IS NULL)
     OR (closed_at IS NOT NULL AND final_worked_minutes IS NOT NULL)),
    CONSTRAINT uq_period_seq UNIQUE (user_id, seq)
);

-- One open period per person: two would make "their current period" meaningless.
CREATE UNIQUE INDEX idx_work_period_one_open ON work_periods(user_id) WHERE closed_at IS NULL;
CREATE INDEX idx_work_periods_user ON work_periods(user_id, seq DESC);

-- The default day count for anyone without their own figure.
INSERT INTO app_settings (key, value) VALUES ('payroll.default-period-days', '30')
  ON CONFLICT (key) DO NOTHING;
