-- Versioned prompt store with soft-delete (story 49)
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

CREATE TABLE prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  reason TEXT,
  UNIQUE(key, version)
);

CREATE INDEX idx_prompts_key ON prompts(key) WHERE deleted = 0;
CREATE INDEX idx_prompts_history ON prompts(key, version DESC);
