-- A user may now hold several roles at once (e.g. SUPERVISOR + MANAGER).
-- app_users.role is replaced by a user_roles join table.

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role    VARCHAR(24) NOT NULL,
  PRIMARY KEY (user_id, role)
);

-- Carry every existing single role across before the column goes away.
INSERT INTO user_roles (user_id, role)
SELECT id, role FROM app_users;

CREATE INDEX idx_user_roles_role ON user_roles(role);

ALTER TABLE app_users DROP COLUMN role;
