-- Curriculum progress tracking: per-section progress for learners
-- Applied via: wrangler d1 migrations apply DB --local

CREATE TABLE curriculum_progress (
  learner_id        TEXT NOT NULL REFERENCES learners(id),
  profile           TEXT NOT NULL,
  section_id        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'not_started',
  understanding_json TEXT DEFAULT '[]',
  started_at        TEXT,
  completed_at      TEXT,
  updated_at        TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (learner_id, profile, section_id)
);

CREATE INDEX idx_curriculum_progress_learner_profile
  ON curriculum_progress(learner_id, profile);
