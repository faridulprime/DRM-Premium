-- Website Builder foundation: isolated draft/published document and 30-day revision timeline.
-- Apply only to the Preview D1 database after the existing 0004 migrations.
CREATE TABLE IF NOT EXISTS site_builder_documents (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  draft_json TEXT NOT NULL,
  published_json TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE TABLE IF NOT EXISTS site_builder_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL REFERENCES site_builder_documents(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  summary TEXT NOT NULL DEFAULT 'Draft change',
  UNIQUE(document_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_site_builder_revisions_time
  ON site_builder_revisions(document_id, created_at DESC);
