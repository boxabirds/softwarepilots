import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Hono } from "hono";

/**
 * Regression test: PUT /api/curriculum/:profile/:sectionId/conversation
 * returns 500 in production because the ON CONFLICT clause targets a
 * partial unique index which D1 may not support.
 *
 * This test uses real SQLite with the actual schema from migrations
 * 0002 + 0003 to reproduce the error.
 */

function createD1Shim(sqliteDb: ReturnType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) {
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
      } as unknown as D1PreparedStatement;
    },
    async batch<T>(): Promise<D1Result<T>[]> { throw new Error("not implemented"); },
    async dump(): Promise<ArrayBuffer> { throw new Error("not implemented"); },
    async exec(): Promise<D1ExecResult> { throw new Error("not implemented"); },
  } as D1Database;
}

let sqliteDb: ReturnType<typeof Database>;

beforeEach(() => {
  sqliteDb = new Database(":memory:");

  // 0001: learners table
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

  // 0002: conversations table (original schema)
  sqliteDb.exec(`
    CREATE TABLE curriculum_conversations (
      id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id    TEXT NOT NULL REFERENCES learners(id),
      profile       TEXT NOT NULL,
      section_id    TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      UNIQUE (learner_id, profile, section_id)
    )
  `);

  // 0003: archive support - recreate table without UNIQUE, add partial index
  sqliteDb.exec(`
    ALTER TABLE curriculum_conversations ADD COLUMN archived_at TEXT
  `);
  // Note: can't drop UNIQUE in SQLite without table recreation.
  // In production migration 0003 does the full recreate.
  // For this test, recreate properly:
  sqliteDb.exec(`
    CREATE TABLE curriculum_conversations_new (
      id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id    TEXT NOT NULL REFERENCES learners(id),
      profile       TEXT NOT NULL,
      section_id    TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      archived_at   TEXT
    );
    INSERT INTO curriculum_conversations_new
      SELECT id, learner_id, profile, section_id, messages_json, created_at, updated_at, archived_at
      FROM curriculum_conversations;
    DROP TABLE curriculum_conversations;
    ALTER TABLE curriculum_conversations_new RENAME TO curriculum_conversations;
    CREATE UNIQUE INDEX idx_curriculum_conversations_active
      ON curriculum_conversations(learner_id, profile, section_id)
      WHERE archived_at IS NULL;
    CREATE INDEX idx_curriculum_conversations_learner
      ON curriculum_conversations(learner_id, profile, section_id);
  `);

  // Seed a learner
  sqliteDb.exec(`
    INSERT INTO learners (id, email, display_name, auth_provider, auth_subject)
    VALUES ('learner-1', 'test@test.com', 'Test', 'github', '123')
  `);
});

describe("PUT conversation upsert with real SQLite", () => {
  it("inserts a new conversation", () => {
    const db = sqliteDb;
    const sql = `INSERT INTO curriculum_conversations (learner_id, profile, section_id, messages_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT (learner_id, profile, section_id) WHERE archived_at IS NULL
     DO UPDATE SET messages_json = excluded.messages_json, updated_at = datetime('now')`;

    db.prepare(sql).run("learner-1", "new-grad", "1.1", '[{"role":"user","content":"hello"}]');

    const row = db.prepare(
      "SELECT messages_json FROM curriculum_conversations WHERE learner_id = ? AND profile = ? AND section_id = ? AND archived_at IS NULL"
    ).get("learner-1", "new-grad", "1.1") as { messages_json: string } | undefined;

    expect(row).toBeTruthy();
    expect(JSON.parse(row!.messages_json)).toEqual([{ role: "user", content: "hello" }]);
  });

  it("upserts an existing conversation", () => {
    const db = sqliteDb;
    const sql = `INSERT INTO curriculum_conversations (learner_id, profile, section_id, messages_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT (learner_id, profile, section_id) WHERE archived_at IS NULL
     DO UPDATE SET messages_json = excluded.messages_json, updated_at = datetime('now')`;

    db.prepare(sql).run("learner-1", "new-grad", "1.1", '[{"role":"user","content":"first"}]');
    db.prepare(sql).run("learner-1", "new-grad", "1.1", '[{"role":"user","content":"second"}]');

    const rows = db.prepare(
      "SELECT messages_json FROM curriculum_conversations WHERE learner_id = ? AND profile = ? AND section_id = ?"
    ).all("learner-1", "new-grad", "1.1") as { messages_json: string }[];

    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].messages_json)).toEqual([{ role: "user", content: "second" }]);
  });

  it("does not conflict with archived conversations", () => {
    const db = sqliteDb;

    // Insert and archive
    db.prepare(
      "INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, archived_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run("old-id", "learner-1", "new-grad", "1.1", '[{"role":"user","content":"old"}]');

    // Insert new active conversation - should not conflict with the archived one
    const sql = `INSERT INTO curriculum_conversations (learner_id, profile, section_id, messages_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT (learner_id, profile, section_id) WHERE archived_at IS NULL
     DO UPDATE SET messages_json = excluded.messages_json, updated_at = datetime('now')`;

    db.prepare(sql).run("learner-1", "new-grad", "1.1", '[{"role":"user","content":"new"}]');

    const all = db.prepare(
      "SELECT messages_json, archived_at FROM curriculum_conversations WHERE learner_id = ? AND profile = ? AND section_id = ? ORDER BY archived_at IS NULL"
    ).all("learner-1", "new-grad", "1.1") as { messages_json: string; archived_at: string | null }[];

    expect(all).toHaveLength(2);
    const archived = all.find(r => r.archived_at !== null);
    const active = all.find(r => r.archived_at === null);
    expect(archived).toBeTruthy();
    expect(active).toBeTruthy();
    expect(JSON.parse(active!.messages_json)).toEqual([{ role: "user", content: "new" }]);
  });

  it("works through the curriculum route handler via D1 shim", async () => {
    const { curriculum } = await import("../curriculum");

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("learnerId" as never, "learner-1");
      await next();
    });
    app.route("/", curriculum);

    const d1 = createD1Shim(sqliteDb);

    // First PUT - creates conversation
    const res1 = await app.request("/new-grad/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
      }),
    }, { DB: d1 } as Record<string, unknown>);

    expect(res1.status).toBe(200);
    const body1 = await res1.json() as { saved: boolean };
    expect(body1.saved).toBe(true);

    // Second PUT - updates conversation
    const res2 = await app.request("/new-grad/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "hello" },
          { role: "tutor", content: "hi there" },
        ],
      }),
    }, { DB: d1 } as Record<string, unknown>);

    expect(res2.status).toBe(200);

    // Verify only one active row with updated messages
    const row = sqliteDb.prepare(
      "SELECT messages_json FROM curriculum_conversations WHERE learner_id = ? AND profile = ? AND section_id = ? AND archived_at IS NULL"
    ).get("learner-1", "new-grad", "1.1") as { messages_json: string };

    const messages = JSON.parse(row.messages_json);
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toBe("hi there");
  });

  it("creates new active conversation after archive", async () => {
    const { curriculum } = await import("../curriculum");

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("learnerId" as never, "learner-1");
      await next();
    });
    app.route("/", curriculum);

    const d1 = createD1Shim(sqliteDb);

    // Create a conversation
    await app.request("/new-grad/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "first session" }] }),
    }, { DB: d1 } as Record<string, unknown>);

    // Archive it (DELETE = archive)
    await app.request("/new-grad/1.1/conversation", {
      method: "DELETE",
    }, { DB: d1 } as Record<string, unknown>);

    // Create a new conversation - should not conflict with archived
    const res = await app.request("/new-grad/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "second session" }] }),
    }, { DB: d1 } as Record<string, unknown>);

    expect(res.status).toBe(200);

    // Should have 2 rows total: 1 archived, 1 active
    const all = sqliteDb.prepare(
      "SELECT messages_json, archived_at FROM curriculum_conversations WHERE learner_id = ? AND profile = ? AND section_id = ?"
    ).all("learner-1", "new-grad", "1.1") as { messages_json: string; archived_at: string | null }[];

    expect(all).toHaveLength(2);
    expect(all.filter(r => r.archived_at === null)).toHaveLength(1);
    expect(all.filter(r => r.archived_at !== null)).toHaveLength(1);
  });
});
