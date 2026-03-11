-- Walking skeleton schema: learners, submissions, progress
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

CREATE TABLE learners (
  id              TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  auth_provider   TEXT NOT NULL,
  auth_subject    TEXT NOT NULL,
  enrolled_at     TEXT DEFAULT (datetime('now')),
  last_active_at  TEXT,
  UNIQUE (auth_provider, auth_subject)
);

CREATE TABLE submissions (
  id                    TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  learner_id            TEXT NOT NULL REFERENCES learners(id),
  module_id             TEXT NOT NULL,
  exercise_id           TEXT NOT NULL,
  content_json          TEXT NOT NULL,
  self_assessment_json  TEXT,
  rubric_version        TEXT NOT NULL,
  score_json            TEXT,
  evaluator_model       TEXT,
  calibration_gap_json  TEXT,
  submitted_at          TEXT DEFAULT (datetime('now')),
  scored_at             TEXT
);

CREATE TABLE progress (
  learner_id      TEXT NOT NULL REFERENCES learners(id),
  module_id       TEXT NOT NULL,
  exercise_id     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'not_started',
  score_json      TEXT,
  attempts        INTEGER DEFAULT 0,
  first_submitted TEXT,
  last_submitted  TEXT,
  PRIMARY KEY (learner_id, module_id, exercise_id)
);

CREATE INDEX idx_progress_learner ON progress(learner_id);
CREATE INDEX idx_submissions_learner ON submissions(learner_id, module_id);
CREATE INDEX idx_submissions_calibration ON submissions(module_id, exercise_id)
  WHERE self_assessment_json IS NOT NULL;
