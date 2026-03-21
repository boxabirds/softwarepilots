CREATE TABLE curriculum_feedback (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  learner_id TEXT NOT NULL REFERENCES learners(id),
  profile TEXT NOT NULL,
  section_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_index INTEGER NOT NULL,
  feedback_text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_feedback_section ON curriculum_feedback(profile, section_id);
