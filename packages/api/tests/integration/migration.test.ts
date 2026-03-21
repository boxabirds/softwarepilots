import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../src/db/migrations/0001_skeleton.sql"
);

describe("D1 migration applies cleanly to SQLite", () => {
  let db: InstanceType<typeof Database>;

  beforeAll(() => {
    db = new Database(":memory:");
    const migration = readFileSync(MIGRATION_PATH, "utf-8");
    db.exec(migration);
  });

  afterAll(() => {
    db.close();
  });

  it("creates learners table with correct columns", () => {
    const info = db.prepare("PRAGMA table_info(learners)").all() as Array<{
      name: string;
    }>;
    const columns = info.map((c) => c.name);
    expect(columns).toContain("id");
    expect(columns).toContain("email");
    expect(columns).toContain("display_name");
    expect(columns).toContain("auth_provider");
    expect(columns).toContain("auth_subject");
    expect(columns).toContain("enrolled_at");
    expect(columns).toContain("last_active_at");
  });

  it("creates submissions table with correct columns", () => {
    const info = db.prepare("PRAGMA table_info(submissions)").all() as Array<{
      name: string;
    }>;
    const columns = info.map((c) => c.name);
    expect(columns).toContain("id");
    expect(columns).toContain("learner_id");
    expect(columns).toContain("module_id");
    expect(columns).toContain("exercise_id");
    expect(columns).toContain("content_json");
    expect(columns).toContain("self_assessment_json");
    expect(columns).toContain("rubric_version");
    expect(columns).toContain("score_json");
    expect(columns).toContain("evaluator_model");
    expect(columns).toContain("calibration_gap_json");
    expect(columns).toContain("submitted_at");
    expect(columns).toContain("scored_at");
  });

  it("creates progress table with correct columns", () => {
    const info = db.prepare("PRAGMA table_info(progress)").all() as Array<{
      name: string;
    }>;
    const columns = info.map((c) => c.name);
    expect(columns).toContain("learner_id");
    expect(columns).toContain("module_id");
    expect(columns).toContain("exercise_id");
    expect(columns).toContain("status");
    expect(columns).toContain("score_json");
    expect(columns).toContain("attempts");
  });

  it("can insert and retrieve a learner", () => {
    db.prepare(
      `INSERT INTO learners (id, email, auth_provider, auth_subject)
       VALUES ('abc123', 'test@example.com', 'github', '12345')`
    ).run();

    const row = db.prepare("SELECT * FROM learners WHERE id = 'abc123'").get() as {
      id: string;
      email: string;
      auth_provider: string;
    };
    expect(row.id).toBe("abc123");
    expect(row.email).toBe("test@example.com");
    expect(row.auth_provider).toBe("github");
  });

  it("enforces unique email constraint", () => {
    expect(() =>
      db.prepare(
        `INSERT INTO learners (id, email, auth_provider, auth_subject)
         VALUES ('def456', 'test@example.com', 'github', '67890')`
      ).run()
    ).toThrow();
  });

  it("enforces unique auth_provider + auth_subject constraint", () => {
    expect(() =>
      db.prepare(
        `INSERT INTO learners (id, email, auth_provider, auth_subject)
         VALUES ('ghi789', 'other@example.com', 'github', '12345')`
      ).run()
    ).toThrow();
  });

  it("can insert a submission and progress row", () => {
    db.prepare(
      `INSERT INTO submissions (id, learner_id, module_id, exercise_id, content_json, rubric_version)
       VALUES ('sub1', 'abc123', '2', '2.1', '{"code":"print(1)"}', 'v1')`
    ).run();

    db.prepare(
      `INSERT INTO progress (learner_id, module_id, exercise_id, status)
       VALUES ('abc123', '2', '2.1', 'submitted')`
    ).run();

    const sub = db.prepare("SELECT * FROM submissions WHERE id = 'sub1'").get() as {
      learner_id: string;
      score_json: string | null;
    };
    expect(sub.learner_id).toBe("abc123");
    expect(sub.score_json).toBeNull();

    const prog = db.prepare(
      "SELECT * FROM progress WHERE learner_id = 'abc123' AND exercise_id = '2.1'"
    ).get() as { status: string; attempts: number };
    expect(prog.status).toBe("submitted");
    expect(prog.attempts).toBe(0);
  });

  it("defaults attempts to 0", () => {
    const prog = db.prepare(
      "SELECT attempts FROM progress WHERE learner_id = 'abc123'"
    ).get() as { attempts: number };
    expect(prog.attempts).toBe(0);
  });
});
