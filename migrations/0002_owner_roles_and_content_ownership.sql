-- DRM-Premium RBAC and content ownership migration.
-- Run this migration once, after 0001_admin.sql and before first Owner setup.

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

ALTER TABLE videos ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- The first account created by the previous bootstrap becomes the single Owner.
UPDATE users
SET role = 'owner'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1);

-- Existing accounts were created by the protected bootstrap/Admin flow.
UPDATE users SET email_verified = 1 WHERE email_verified IS NULL;

CREATE INDEX IF NOT EXISTS idx_videos_owner_created ON videos(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_owner_name ON categories(owner_id, name);
