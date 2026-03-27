-- Versioned curricula and enrollment (story 60)
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

-- Curriculum content with soft-delete versioning (adapted from prompt-manager pattern)
CREATE TABLE curriculum_versions (
  id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  profile       TEXT NOT NULL,
  version       INTEGER NOT NULL,
  content_json  TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  deleted       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  created_by    TEXT,
  reason        TEXT,
  UNIQUE (profile, version)
);

CREATE INDEX idx_cv_current ON curriculum_versions(profile) WHERE deleted = 0;

-- Course-level enrollment pinning learner to a curriculum version
CREATE TABLE enrollments (
  id                  TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  learner_id          TEXT NOT NULL REFERENCES learners(id),
  profile             TEXT NOT NULL,
  curriculum_version  INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',
  enrolled_at         TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now')),
  UNIQUE (learner_id, profile)
);

CREATE INDEX idx_enrollments_learner ON enrollments(learner_id, profile);
