-- Learning maps stored in DB with content-hash keying (story 61)
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

CREATE TABLE learning_maps (
  profile       TEXT NOT NULL,
  section_id    TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  map_json      TEXT NOT NULL,
  model_used    TEXT NOT NULL,
  generated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile, section_id, content_hash)
);
