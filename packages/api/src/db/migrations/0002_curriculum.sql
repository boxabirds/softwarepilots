-- Curriculum conversation persistence: stores tutor chat history per learner/profile/section
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

CREATE TABLE curriculum_conversations (
  id          TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  learner_id  TEXT NOT NULL REFERENCES learners(id),
  profile     TEXT NOT NULL,
  section_id  TEXT NOT NULL,
  messages_json TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE (learner_id, profile, section_id)
);

CREATE INDEX idx_curriculum_conversations_learner
  ON curriculum_conversations(learner_id, profile);
