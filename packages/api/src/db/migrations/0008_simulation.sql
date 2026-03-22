-- Simulation sessions and events for interactive scenario-based learning
-- Applied via: wrangler d1 migrations apply softwarepilots-db --local

CREATE TABLE simulation_sessions (
  id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  learner_id    TEXT NOT NULL REFERENCES learners(id),
  scenario_id   TEXT NOT NULL,
  profile       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  current_phase TEXT NOT NULL,
  started_at    TEXT DEFAULT (datetime('now')),
  completed_at  TEXT,
  debrief_json  TEXT
);

CREATE TABLE simulation_events (
  id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  session_id    TEXT NOT NULL REFERENCES simulation_sessions(id),
  event_type    TEXT NOT NULL,
  event_data    TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_sim_sessions_learner ON simulation_sessions(learner_id);
CREATE INDEX idx_sim_events_session ON simulation_events(session_id);
