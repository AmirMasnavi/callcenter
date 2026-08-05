# Database Schema & Migrations

The system relies on PostgreSQL for persistent storage and uses **Flyway** for database migration control (`services/api/src/main/resources/db/migration`).

---

## 🗄 Entity Relationship Diagram (Conceptual)

```
       +-----------------------+           +-----------------------+
       |       app_users       |           |     daily_reports     |
       +-----------------------+           +-----------------------+
       | id (PK)               |<---------+| agent_id (FK)         |
       | username (UNIQUE)     |           | report_date           |
       | password_hash         |           | report_label          |
       | display_name          |           | total_people          |
       | role                  |           | contacted_count       |
       | supervisor_id (FK)    |---+       | ok_count              |
       | active                |   |       | maybe_count           |
       | must_change_password  |   |       | no_count              |
       | avatar_bytes          |   |       | no_answer_count       |
       | avatar_content_type   |   |       | notes                 |
       +-----------------------+   |       | status                |
                                   |       | reviewer_id (FK)      |
                                   |       | version (@Version)    |
                                   |       +-----------+-----------+
                                   |                   |
                                   |                   | 1:N
                                   v                   v
                       +-----------+-------------------+---+
                       |         report_revisions          |
                       +-----------------------------------+
                       | id (PK)                           |
                       | report_id (FK)                    |
                       | actor_id (FK)                     |
                       | reason                            |
                       | old_values (JSON/TEXT)            |
                       | new_values (JSON/TEXT)            |
                       +-----------------------------------+
```

---

## 📜 Flyway Migration Files

### 1. `V1__initial_schema.sql`
Initial table definitions, primary constraints, and indexes.

#### `app_users` Table
Stores authentication credentials, supervisor relationships, and password change flags.
```sql
CREATE TABLE app_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  supervisor_id BIGINT REFERENCES app_users(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_bytes BYTEA,
  avatar_content_type VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> The single `role` column was removed in migration **V4**. Roles now live in `user_roles`,
> so one user can hold several.

#### `user_roles` Table (V4)
One row per role a user holds.
```sql
CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role    VARCHAR(24) NOT NULL,   -- AGENT | SUPERVISOR | MANAGER | ADMIN
  PRIMARY KEY (user_id, role)
);
```

#### `user_permissions` Table (V6)
Fine-grained capabilities layered on top of roles. Roles supply the defaults
(`Permission.defaultsFor`); this table stores only the **exceptions** for a user.
```sql
CREATE TABLE user_permissions (
  user_id    BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  permission VARCHAR(32) NOT NULL,
  granted    BOOLEAN     NOT NULL,  -- TRUE = add, FALSE = withhold
  PRIMARY KEY (user_id, permission)
);
```

> Effective permissions = role defaults **+** grants **−** revokes. Revokes apply last, so a
> capability can always be taken back. Storing revokes explicitly means an admin can keep a
> user in a role while withholding one ability, instead of inventing a role per exception.

#### `daily_reports` Table
Stores daily performance counters and audit status.
```sql
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
  -- V5: voiding is a soft delete, so revisions and audit rows stay valid.
  voided_at   TIMESTAMPTZ,
  voided_by   BIGINT REFERENCES app_users(id),
  void_reason VARCHAR(1000)
);

CREATE INDEX idx_reports_date_status ON daily_reports(report_date, status);
CREATE INDEX idx_reports_agent ON daily_reports(agent_id);
```

#### `report_revisions` Table
Tracks justification reason and delta snapshots whenever an approved/reviewed report is edited.
```sql
CREATE TABLE report_revisions (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES daily_reports(id),
  actor_id BIGINT NOT NULL REFERENCES app_users(id),
  reason VARCHAR(1000) NOT NULL,
  old_values TEXT NOT NULL,
  new_values TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `audit_events` Table
Global audit log for actions such as logins, user creation, and status transitions.
```sql
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
```

---

### 2. `V2__multiple_reports_and_labels.sql`
Enables operators to submit multiple distinct reports per date by introducing custom labels and dropping the single daily constraint.
```sql
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS uq_agent_report_date;
ALTER TABLE daily_reports ADD COLUMN report_label VARCHAR(120);
CREATE INDEX idx_reports_agent_date_created ON daily_reports(agent_id, report_date DESC, created_at DESC);
```

---

### 3. `V3__user_avatars.sql`
Adds support for storing user profile picture binary data.
```sql
ALTER TABLE app_users ADD COLUMN avatar_bytes BYTEA;
ALTER TABLE app_users ADD COLUMN avatar_content_type VARCHAR(80);
```

---

### 4. `V10__attendance.sql`
Worked hours, replacing the paper timesheet.
```sql
CREATE TABLE attendance_entries (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES app_users(id),
    entry_at       TIMESTAMPTZ NOT NULL,
    exit_at        TIMESTAMPTZ,              -- NULL while the shift is still running
    note           VARCHAR(300),
    recorded_by_id BIGINT NOT NULL REFERENCES app_users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one OPEN shift per person: a second clock-in without a clock-out is rejected
-- rather than silently creating an orphan. A backdated entry is always closed, so it
-- never contends with this.
CREATE UNIQUE INDEX idx_attendance_one_open_shift
    ON attendance_entries(user_id) WHERE exit_at IS NULL;

ALTER TABLE app_users ADD COLUMN monthly_hours_target INT;  -- NULL = use the system default
```

**Worked minutes are derived, never stored** (`AttendanceEntry.workedMinutes()`). A stored
duration goes stale the moment either timestamp is corrected, and payroll is precisely where
that must not happen. An open shift contributes `0` — unfinished time is not yet worked time.

**Days are bounded in Asia/Tehran, not UTC.** A shift ending at 00:30 belongs to the day it
started; UTC bucketing files it under the wrong date. `AttendanceService.ZONE` is the single
source of that boundary.

---

## 🔒 Session Management Schema
`Spring Session JDBC` creates the following tables dynamically or via Flyway on initial setup:
- `SPRING_SESSION`
- `SPRING_SESSION_ATTRIBUTES`
