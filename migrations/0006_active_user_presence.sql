CREATE TABLE IF NOT EXISTS visitor_presence (
 presence_key TEXT PRIMARY KEY,
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 guest_label TEXT,
 last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitor_presence_seen ON visitor_presence(last_seen);
CREATE INDEX IF NOT EXISTS idx_visitor_presence_user ON visitor_presence(user_id,last_seen);
