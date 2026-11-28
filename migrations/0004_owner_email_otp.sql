-- One-time email OTP for first Owner setup.
CREATE TABLE IF NOT EXISTS owner_setup_otps (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);