CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, tab TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tab_time ON analytics_events(tab,created_at);
CREATE TABLE IF NOT EXISTS admin_presence (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, last_seen INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_admin_presence_seen ON admin_presence(last_seen);
