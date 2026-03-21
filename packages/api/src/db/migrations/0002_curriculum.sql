-- Curriculum tables: conversation persistence (story 28) and progress tracking (story 29)
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

-- Conversation persistence (story 28)
CREATE TABLE curriculum_conversations (
  id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  learner_id    TEXT NOT NULL REFERENCES learners(id),
  profile       TEXT NOT NULL,
  section_id    TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE (learner_id, profile, section_id)
);

-- Progress tracking (story 29)
CREATE TABLE curriculum_progress (
  learner_id         TEXT NOT NULL REFERENCES learners(id),
  profile            TEXT NOT NULL,
  section_id         TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'not_started',
  understanding_json TEXT,
  started_at         TEXT,
  updated_at         TEXT,
  PRIMARY KEY (learner_id, profile, section_id)
);

CREATE INDEX idx_curriculum_conversations_learner ON curriculum_conversations(learner_id, profile, section_id);
CREATE INDEX idx_curriculum_progress_learner ON curriculum_progress(learner_id, profile);
