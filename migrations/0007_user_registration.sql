-- Public user registration with short-lived email verification codes.
CREATE TABLE IF NOT EXISTS user_registration_otps (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_registration_otps_ip_time
  ON user_registration_otps(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_user_registration_otps_expiry
  ON user_registration_otps(expires_at);
