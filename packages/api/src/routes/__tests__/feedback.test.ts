import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";

/* ---- D1 shim over bun:sqlite ---- */

function createD1Shim(sqliteDb: InstanceType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      let bindings: any[] = [];
      return {
        bind(...values: any[]) {
          bindings = values;
          return this;
        },
        async first<T>(): Promise<T | null> {
          const stmt = sqliteDb.prepare(query);
          const row = stmt.get(...bindings) as T | undefined;
          return row ?? null;
        },
        async run(): Promise<D1Response> {
          const stmt = sqliteDb.prepare(query);
          const info = stmt.run(...bindings);
          return {
            success: true,
            meta: {
              duration: 0,
              changes: info.changes,
              last_row_id: info.lastInsertRowid as number,
              changed_db: info.changes > 0,
              size_after: 0,
              rows_read: 0,
              rows_written: info.changes,
            },
          };
        },
        async all<T>(): Promise<D1Result<T>> {
          const stmt = sqliteDb.prepare(query);
          const rows = stmt.all(...bindings) as T[];
          return {
            results: rows,
            success: true,
            meta: {
              duration: 0,
              changes: 0,
              last_row_id: 0,
              changed_db: false,
              size_after: 0,
              rows_read: rows.length,
              rows_written: 0,
            },
          };
        },
      } as unknown as D1PreparedStatement;
    },
    async batch<T>(): Promise<D1Result<T>[]> { throw new Error("not implemented"); },
    async dump(): Promise<ArrayBuffer> { throw new Error("not implemented"); },
    async exec(): Promise<D1ExecResult> { throw new Error("not implemented"); },
  } as unknown as D1Database;
}

let sqliteDb: InstanceType<typeof Database>;

function buildApp() {
  // Dynamic import to get fresh module
  const { curriculum } = require("../curriculum");
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("learnerId" as never, "learner-1");
    await next();
  });
  app.route("/", curriculum);
  return app;
}

beforeEach(() => {
  sqliteDb = new Database(":memory:");

  // Learners table (from 0001)
  sqliteDb.exec(`
    CREATE TABLE learners (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT,
      auth_provider TEXT NOT NULL,
      auth_subject TEXT NOT NULL,
      enrolled_at TEXT DEFAULT (datetime('now')),
      last_active_at TEXT
    )
  `);

  // Feedback table (from 0007)
  sqliteDb.exec(`
    CREATE TABLE curriculum_feedback (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      message_content TEXT NOT NULL,
      message_index INTEGER NOT NULL,
      feedback_text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_feedback_section ON curriculum_feedback(profile, section_id);
  `);

  // Seed a learner
  sqliteDb.exec(`
    INSERT INTO learners (id, email, display_name, auth_provider, auth_subject)
    VALUES ('learner-1', 'test@test.com', 'Test', 'github', '123')
  `);
});

describe("POST /:profile/:sectionId/feedback", () => {
  it("returns 200 with valid data and persists in DB", async () => {
    const app = buildApp();
    const d1 = createD1Shim(sqliteDb);

    const res = await app.request("/level-1/1.1/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_content: "What is recursion?",
        message_index: 2,
        feedback_text: "This explanation was confusing",
      }),
    }, { DB: d1 } as Record<string, unknown>);

    expect(res.status).toBe(200);
    const body = await res.json() as { saved: boolean };
    expect(body.saved).toBe(true);

    // Verify persisted
    const row = sqliteDb.prepare(
      "SELECT learner_id, profile, section_id, message_content, message_index, feedback_text FROM curriculum_feedback"
    ).get() as { learner_id: string; profile: string; section_id: string; message_content: string; message_index: number; feedback_text: string };

    expect(row.learner_id).toBe("learner-1");
    expect(row.profile).toBe("level-1");
    expect(row.section_id).toBe("1.1");
    expect(row.message_content).toBe("What is recursion?");
    expect(row.message_index).toBe(2);
    expect(row.feedback_text).toBe("This explanation was confusing");
  });

  it("returns 400 when feedback_text is missing", async () => {
    const app = buildApp();
    const d1 = createD1Shim(sqliteDb);

    const res = await app.request("/level-1/1.1/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_content: "What is recursion?",
        message_index: 2,
      }),
    }, { DB: d1 } as Record<string, unknown>);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("feedback_text");
  });

  it("returns 400 with invalid profile", async () => {
    const app = buildApp();
    const d1 = createD1Shim(sqliteDb);

    const res = await app.request("/invalid-profile/1.1/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_content: "What is recursion?",
        message_index: 2,
        feedback_text: "This was confusing",
      }),
    }, { DB: d1 } as Record<string, unknown>);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Invalid profile");
  });

  it("returns 400 with invalid section_id", async () => {
    const app = buildApp();
    const d1 = createD1Shim(sqliteDb);

    const res = await app.request("/level-1/bad-section/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_content: "What is recursion?",
        message_index: 2,
        feedback_text: "This was confusing",
      }),
    }, { DB: d1 } as Record<string, unknown>);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Invalid section_id");
  });
});
