-- Enforce the single-Owner invariant at the database layer.
-- Run once after 0002_owner_roles_and_content_ownership.sql.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_owner
ON users(role)
WHERE role = 'owner';
