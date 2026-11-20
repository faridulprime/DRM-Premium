PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'admin',created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,ip_hash TEXT NOT NULL,attempted_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_hash,attempted_at);
CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,youtube_id TEXT NOT NULL,thumbnail_url TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',featured INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_videos_public ON videos(published,featured,sort_order);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
INSERT OR IGNORE INTO categories(id,name,sort_order) VALUES ('cat-featured','Featured',1),('cat-education','Education',2),('cat-entertainment','Entertainment',3);
INSERT OR IGNORE INTO videos(id,title,category,youtube_id,thumbnail_url,description,featured,published,sort_order,created_at,updated_at) VALUES
('demo1','The Art of Cinematic Storytelling','Featured','ysz5S6PUM-U','','একটি নমুনা ভিডিও। Admin Panel থেকে নিজের ভিডিও যোগ করুন।',1,1,1,0,0),
('demo2','Learn Something New Today','Education','ScMzIvxBSi4','','শিক্ষামূলক ভিডিওর নমুনা।',0,1,2,0,0),
('demo3','Creative Inspiration','Entertainment','aqz-KE-bpKQ','','বিনোদন বিভাগের নমুনা ভিডিও।',0,1,3,0,0);
INSERT OR IGNORE INTO settings(key,value) VALUES
('site_name','FRAME'),('hero_eyebrow','EDITOR''S PICK'),('hero_title',''),('hero_description',''),('library_eyebrow','DISCOVER'),('library_title','ভিডিও লাইব্রেরি'),('footer_text','একটি ব্যক্তিগত ভিডিও লাইব্রেরি'),('hero_image','https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1800&q=85'),('accent_color','#e50914'),('show_hero','true'),('show_library','true');