-- Add concepts_json to enrollments for cross-module spaced repetition (story 62)
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

ALTER TABLE enrollments ADD COLUMN concepts_json TEXT;
