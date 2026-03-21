-- Add concept-level tracking and session pause support (story 33)
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

ALTER TABLE curriculum_progress ADD COLUMN concepts_json TEXT DEFAULT '{}';
ALTER TABLE curriculum_progress ADD COLUMN paused_at TEXT;
