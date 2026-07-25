ALTER TABLE app_users ADD COLUMN avatar_bytes BYTEA;
ALTER TABLE app_users ADD COLUMN avatar_content_type VARCHAR(80);
