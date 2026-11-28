CREATE TABLE IF NOT EXISTS user_restrictions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('suspend', 'ban')),
  expires_at INTEGER,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  CHECK (
    (restriction_type = 'suspend' AND expires_at IS NOT NULL) OR
    (restriction_type = 'ban' AND expires_at IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_expiry
  ON user_restrictions(expires_at);

CREATE TABLE IF NOT EXISTS user_activity_hours (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hour_start INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (user_id, hour_start)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_hours_time
  ON user_activity_hours(hour_start);
