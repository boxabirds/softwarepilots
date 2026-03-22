-- Add claim-level tracking for learning map assessments (story 54)
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

ALTER TABLE curriculum_progress ADD COLUMN claims_json TEXT DEFAULT '{}';
