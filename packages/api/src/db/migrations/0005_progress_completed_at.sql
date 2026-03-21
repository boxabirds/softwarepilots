-- Add missing completed_at column to curriculum_progress
-- Referenced in curriculum-progress.ts but never created in prior migrations
ALTER TABLE curriculum_progress ADD COLUMN completed_at TEXT;
