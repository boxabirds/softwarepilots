import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SKELETON_PATH = resolve(
  __dirname,
  "../../src/db/migrations/0001_skeleton.sql"
);
const CURRICULUM_PATH = resolve(
  __dirname,
  "../../src/db/migrations/0002_curriculum.sql"
);

describe("0002_curriculum migration applies cleanly", () => {
  let db: InstanceType<typeof Database>;

  beforeAll(() => {
    db = new Database(":memory:");
    db.exec(readFileSync(SKELETON_PATH, "utf-8"));
    db.exec(readFileSync(CURRICULUM_PATH, "utf-8"));

    // Seed a learner for FK tests
    db.prepare(
      `INSERT INTO learners (id, email, auth_provider, auth_subject)
       VALUES ('LEARNER1', 'learner@test.com', 'google', 'sub1')`
    ).run();
  });

  afterAll(() => {
    db.close();
  });

  it("creates curriculum_conversations table with correct columns", () => {
    const info = db
      .prepare("PRAGMA table_info(curriculum_conversations)")
      .all() as Array<{ name: string }>;
    const columns = info.map((c) => c.name);
    expect(columns).toEqual([
      "id",
      "learner_id",
      "profile",
      "section_id",
      "messages_json",
      "created_at",
      "updated_at",
    ]);
  });

  it("creates curriculum_progress table with correct columns", () => {
    const info = db
      .prepare("PRAGMA table_info(curriculum_progress)")
      .all() as Array<{ name: string }>;
    const columns = info.map((c) => c.name);
    expect(columns).toEqual([
      "learner_id",
      "profile",
      "section_id",
      "status",
      "understanding_json",
      "started_at",
      "updated_at",
    ]);
  });

  it("can insert a conversation row", () => {
    db.prepare(
      `INSERT INTO curriculum_conversations (learner_id, profile, section_id, messages_json)
       VALUES ('LEARNER1', 'backend-dev', 'intro-1', '[{"role":"user","content":"hello"}]')`
    ).run();

    const row = db
      .prepare(
        "SELECT * FROM curriculum_conversations WHERE learner_id = 'LEARNER1'"
      )
      .get() as {
      learner_id: string;
      profile: string;
      section_id: string;
      messages_json: string;
      created_at: string;
      updated_at: string;
    };
    expect(row.learner_id).toBe("LEARNER1");
    expect(row.profile).toBe("backend-dev");
    expect(row.messages_json).toContain("hello");
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();
  });

  it("enforces UNIQUE constraint on (learner_id, profile, section_id) for conversations", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO curriculum_conversations (learner_id, profile, section_id, messages_json)
         VALUES ('LEARNER1', 'backend-dev', 'intro-1', '[]')`
        )
        .run()
    ).toThrow();
  });

  it("supports upsert via ON CONFLICT on conversations", () => {
    const updatedMessages = '[{"role":"user","content":"updated"}]';
    db.prepare(
      `INSERT INTO curriculum_conversations (learner_id, profile, section_id, messages_json)
       VALUES ('LEARNER1', 'backend-dev', 'intro-1', ?)
       ON CONFLICT(learner_id, profile, section_id)
       DO UPDATE SET messages_json = excluded.messages_json, updated_at = datetime('now')`
    ).run(updatedMessages);

    const row = db
      .prepare(
        "SELECT messages_json FROM curriculum_conversations WHERE learner_id = 'LEARNER1' AND profile = 'backend-dev' AND section_id = 'intro-1'"
      )
      .get() as { messages_json: string };
    expect(row.messages_json).toBe(updatedMessages);
  });

  it("can insert a progress row with default status", () => {
    db.prepare(
      `INSERT INTO curriculum_progress (learner_id, profile, section_id)
       VALUES ('LEARNER1', 'backend-dev', 'intro-1')`
    ).run();

    const row = db
      .prepare(
        "SELECT * FROM curriculum_progress WHERE learner_id = 'LEARNER1'"
      )
      .get() as { status: string; understanding_json: string | null };
    expect(row.status).toBe("not_started");
    expect(row.understanding_json).toBeNull();
  });

  it("enforces composite PK on curriculum_progress", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO curriculum_progress (learner_id, profile, section_id)
         VALUES ('LEARNER1', 'backend-dev', 'intro-1')`
        )
        .run()
    ).toThrow();
  });

  it("creates indexes on curriculum tables", () => {
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_curriculum%'"
      )
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_curriculum_conversations_learner");
    expect(names).toContain("idx_curriculum_progress_learner");
  });
});
