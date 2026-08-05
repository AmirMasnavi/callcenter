-- Managed school names.
--
-- School was free text, so "دبیرستان فردوسی" and "دبيرستان  فردوسى" became different rows
-- in the manager's per-school comparison. `normalized_name` holds a canonical form
-- (trimmed, inner whitespace collapsed, Arabic yeh/kaf folded to Persian, zero-width
-- characters stripped) and carries the uniqueness, while `name` keeps what was typed.
CREATE TABLE schools (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(160) NOT NULL,
  normalized_name VARCHAR(160) NOT NULL UNIQUE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schools_active ON schools(active) WHERE active;

-- Adopt whatever operators have already typed, folding duplicates together.
INSERT INTO schools (name, normalized_name)
SELECT DISTINCT ON (norm) school, norm
FROM (
  SELECT school,
         regexp_replace(
           translate(btrim(school), 'يكۀةى', 'یکهها'),
           '\s+', ' ', 'g') AS norm
  FROM daily_reports
  WHERE school IS NOT NULL AND btrim(school) <> ''
) t
ORDER BY norm, school;

-- Point existing reports at the canonical spelling.
UPDATE daily_reports r
SET school = s.name
FROM schools s
WHERE r.school IS NOT NULL
  AND regexp_replace(translate(btrim(r.school), 'يكۀةى', 'یکهها'), '\s+', ' ', 'g') = s.normalized_name;

-- Runtime settings an admin can change without a redeploy.
CREATE TABLE app_settings (
  key   VARCHAR(64) PRIMARY KEY,
  value VARCHAR(256) NOT NULL
);

INSERT INTO app_settings (key, value) VALUES
  ('login.guard.enabled', 'true'),
  ('login.guard.max-attempts', '5'),
  ('login.guard.lockout-minutes', '15');
