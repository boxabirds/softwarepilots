import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";

/* ---- D1Database shim using bun:sqlite ---- */

function createD1Shim(sqliteDb: InstanceType<typeof Database>): D1Database {
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
        async all<T>(): Promise<D1Result<T>> {
          const stmt = sqliteDb.prepare(query);
          const rows = stmt.all(...bindings) as T[];
          return {
            results: rows,
            success: true,
            meta: {} as D1Result<T>["meta"],
          };
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

/* ---- Test fixtures ---- */

const TEST_LEARNER_ID = "learner-001";
const TEST_LEARNER_NAME = "Alice";

let sqliteDb: InstanceType<typeof Database>;
let app: InstanceType<typeof Hono>;

beforeEach(async () => {
  sqliteDb = new Database(":memory:");

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

  sqliteDb.exec(`
    CREATE TABLE curriculum_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      message_content TEXT NOT NULL,
      message_index INTEGER NOT NULL,
      feedback_text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  sqliteDb
    .prepare(
      "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)"
    )
    .run(TEST_LEARNER_ID, "alice@example.com", TEST_LEARNER_NAME, "github", "gh-123");

  const db = createD1Shim(sqliteDb);

  // Import and mount the admin router
  const { admin } = await import("../admin");
  app = new Hono();
  // Inject DB binding
  app.use("*", async (c, next) => {
    c.env = { DB: db } as never;
    await next();
  });
  app.route("/api/admin", admin);
});

/* ---- Tests ---- */

describe("GET /api/admin/feedback", () => {
  it("returns empty array when no feedback exists", async () => {
    const res = await app.request("/api/admin/feedback");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns entries with learner_name after inserting feedback", async () => {
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_feedback (learner_id, profile, section_id, message_content, message_index, feedback_text)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(TEST_LEARNER_ID, "level-1", "1.1", "Hello world", 0, "Great explanation");

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_feedback (learner_id, profile, section_id, message_content, message_index, feedback_text)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(TEST_LEARNER_ID, "level-1", "1.2", "Another message", 3, "Needs work");

    const res = await app.request("/api/admin/feedback");
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(data).toHaveLength(2);
    expect(data[0].learner_name).toBe(TEST_LEARNER_NAME);
    expect(data[0].profile).toBe("level-1");
    expect(data[0].feedback_text).toBeTruthy();
    expect(data[1].learner_name).toBe(TEST_LEARNER_NAME);
  });
});

describe("DELETE /api/admin/feedback/:id", () => {
  it("removes an existing entry", async () => {
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_feedback (learner_id, profile, section_id, message_content, message_index, feedback_text)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(TEST_LEARNER_ID, "level-1", "1.1", "msg", 0, "fb");

    const row = sqliteDb.prepare("SELECT id FROM curriculum_feedback").get() as { id: number };

    const res = await app.request(`/api/admin/feedback/${row.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.deleted).toBe(true);

    // Verify gone
    const remaining = sqliteDb.prepare("SELECT COUNT(*) as cnt FROM curriculum_feedback").get() as { cnt: number };
    expect(remaining.cnt).toBe(0);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await app.request("/api/admin/feedback/99999", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBeTruthy();
  });
});
