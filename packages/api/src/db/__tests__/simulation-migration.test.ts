import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function applyMigrations(db: InstanceType<typeof Database>, ...names: string[]) {
  for (const name of names) {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf-8");
    db.exec(sql);
  }
}

let db: InstanceType<typeof Database>;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(
    db,
    "0001_skeleton.sql",
    "0008_simulation.sql"
  );
});

describe("0008_simulation migration", () => {
  it("creates simulation_sessions table with correct columns", () => {
    const columns = db.prepare("PRAGMA table_info(simulation_sessions)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const colMap = Object.fromEntries(columns.map((c) => [c.name, c]));

    expect(colMap.id.pk).toBe(1);
    expect(colMap.id.type).toBe("TEXT");
    expect(colMap.learner_id.notnull).toBe(1);
    expect(colMap.scenario_id.notnull).toBe(1);
    expect(colMap.profile.notnull).toBe(1);
    expect(colMap.status.notnull).toBe(1);
    expect(colMap.status.dflt_value).toBe("'active'");
    expect(colMap.current_phase.notnull).toBe(1);
    expect(colMap.started_at).toBeDefined();
    expect(colMap.completed_at).toBeDefined();
    expect(colMap.debrief_json).toBeDefined();
  });

  it("creates simulation_events table with correct columns", () => {
    const columns = db.prepare("PRAGMA table_info(simulation_events)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>;

    const colMap = Object.fromEntries(columns.map((c) => [c.name, c]));

    expect(colMap.id.pk).toBe(1);
    expect(colMap.session_id.notnull).toBe(1);
    expect(colMap.event_type.notnull).toBe(1);
    expect(colMap.event_data.notnull).toBe(1);
    expect(colMap.created_at).toBeDefined();
  });

  it("creates indexes on learner_id and session_id", () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_sim%'"
    ).all() as Array<{ name: string }>;

    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_sim_sessions_learner");
    expect(names).toContain("idx_sim_events_session");
  });

  it("can insert and query a session with auto-generated id", () => {
    // Seed a learner first
    db.exec(`
      INSERT INTO learners (id, email, auth_provider, auth_subject)
      VALUES ('l1', 'test@test.com', 'github', '123')
    `);

    db.prepare(`
      INSERT INTO simulation_sessions (id, learner_id, scenario_id, profile, current_phase)
      VALUES ('s1', 'l1', 'scenario-a', 'level-1', 'intro')
    `).run();

    const row = db.prepare("SELECT * FROM simulation_sessions WHERE id = 's1'").get() as {
      id: string;
      learner_id: string;
      status: string;
      started_at: string;
    };

    expect(row.id).toBe("s1");
    expect(row.learner_id).toBe("l1");
    expect(row.status).toBe("active");
    expect(row.started_at).toBeTruthy();
  });

  it("can insert and query events linked to a session", () => {
    db.exec(`
      INSERT INTO learners (id, email, auth_provider, auth_subject)
      VALUES ('l1', 'test@test.com', 'github', '123')
    `);
    db.prepare(`
      INSERT INTO simulation_sessions (id, learner_id, scenario_id, profile, current_phase)
      VALUES ('s1', 'l1', 'scenario-a', 'level-1', 'intro')
    `).run();

    db.prepare(`
      INSERT INTO simulation_events (id, session_id, event_type, event_data)
      VALUES ('e1', 's1', 'user_message', '{"text":"hello"}')
    `).run();

    const row = db.prepare("SELECT * FROM simulation_events WHERE id = 'e1'").get() as {
      session_id: string;
      event_type: string;
      event_data: string;
      created_at: string;
    };

    expect(row.session_id).toBe("s1");
    expect(row.event_type).toBe("user_message");
    expect(row.event_data).toBe('{"text":"hello"}');
    expect(row.created_at).toBeTruthy();
  });

  it("enforces FK - rejects event with invalid session_id", () => {
    db.exec("PRAGMA foreign_keys = ON");

    expect(() => {
      db.prepare(`
        INSERT INTO simulation_events (id, session_id, event_type, event_data)
        VALUES ('e1', 'nonexistent', 'user_message', '{}')
      `).run();
    }).toThrow();
  });
});
