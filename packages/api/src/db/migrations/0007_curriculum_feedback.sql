-- Curriculum feedback: learner feedback on specific messages within sections
CREATE TABLE curriculum_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  profile TEXT NOT NULL,
  section_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_index INTEGER NOT NULL,
  feedback_text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_curriculum_feedback_learner ON curriculum_feedback(learner_id);
CREATE INDEX idx_curriculum_feedback_created ON curriculum_feedback(created_at);
