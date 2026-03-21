-- Add archival support for conversation reset (story 28 PRD: archive, not delete)
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

-- Add archived_at column
ALTER TABLE curriculum_conversations ADD COLUMN archived_at TEXT;

-- Drop the unique constraint so archived + active rows can coexist
-- SQLite doesn't support DROP CONSTRAINT, so we recreate the table
CREATE TABLE curriculum_conversations_new (
  id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  learner_id    TEXT NOT NULL REFERENCES learners(id),
  profile       TEXT NOT NULL,
  section_id    TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  archived_at   TEXT
);

INSERT INTO curriculum_conversations_new
  SELECT id, learner_id, profile, section_id, messages_json, created_at, updated_at, archived_at
  FROM curriculum_conversations;

DROP TABLE curriculum_conversations;
ALTER TABLE curriculum_conversations_new RENAME TO curriculum_conversations;

-- Index for finding the active conversation
CREATE UNIQUE INDEX idx_curriculum_conversations_active
  ON curriculum_conversations(learner_id, profile, section_id)
  WHERE archived_at IS NULL;

-- Index for listing all conversations (including archived)
CREATE INDEX idx_curriculum_conversations_learner
  ON curriculum_conversations(learner_id, profile, section_id);
