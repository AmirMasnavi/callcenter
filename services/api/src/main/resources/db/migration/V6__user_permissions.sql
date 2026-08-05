-- Fine-grained capabilities on top of roles.
--
-- Roles supply defaults (see Permission.defaultsFor); this table records only the
-- EXCEPTIONS for a given user: granted = TRUE adds a capability their roles don't
-- include, granted = FALSE removes one they otherwise would have. Storing revokes
-- explicitly lets an admin keep someone in a role while withholding a single ability,
-- instead of inventing a new role for every exception.

CREATE TABLE user_permissions (
  user_id    BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  permission VARCHAR(32) NOT NULL,
  granted    BOOLEAN     NOT NULL,
  PRIMARY KEY (user_id, permission)
);

CREATE INDEX idx_user_permissions_permission ON user_permissions(permission);
