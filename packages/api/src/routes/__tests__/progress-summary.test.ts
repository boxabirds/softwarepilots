import { describe, it, expect, beforeEach, vi } from "vitest";
import { sign } from "hono/jwt";
import Database from "better-sqlite3";
import app from "../../index";
import { _clearNarrativeCache } from "../curriculum";

/* ---- D1Database shim using better-sqlite3 ---- */

function createD1Shim(sqliteDb: ReturnType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bindings = values;
          return this;
        },
        async first<T>(columnName?: string): Promise<T | null> {
          const stmt = sqliteDb.prepare(query);
          const row = stmt.get(...bindings) as Record<string, unknown> | undefined;
          if (!row) return null;
          if (columnName) return (row[columnName] as T) ?? null;
          return row as T;
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
    async batch<T>(_stmts: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      throw new Error("batch not implemented in shim");
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error("dump not implemented in shim");
    },
    async exec(_query: string): Promise<D1ExecResult> {
      throw new Error("exec not implemented in shim");
    },
  } as D1Database;
}

/* ---- Auth helper ---- */

const JWT_SECRET = "test-secret-at-least-32-chars-long";
const TEST_LEARNER_ID = "test-learner-summary";

async function authCookie(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: TEST_LEARNER_ID, iat: now, exp: now + 3600 },
    JWT_SECRET
  );
  return `sp_session=${token}`;
}

/* ---- DB setup ---- */

let sqliteDb: ReturnType<typeof Database>;
let db: D1Database;

function buildTestEnv() {
  return {
    ENVIRONMENT: "local",
    JWT_SECRET,
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
    WEB_APP_URL: "http://localhost:3000",
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "gemini-2.0-flash",
    DB: db,
  };
}

beforeEach(() => {
  _clearNarrativeCache();

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
    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      understanding_json TEXT DEFAULT '[]',
      concepts_json TEXT DEFAULT '{}',
      started_at TEXT,
      completed_at TEXT,
      paused_at TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (learner_id, profile, section_id)
    )
  `);

  sqliteDb.exec(`
    CREATE TABLE curriculum_conversations (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      archived_at TEXT,
      UNIQUE (learner_id, profile, section_id)
    )
  `);

  sqliteDb
    .prepare(
      "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)"
    )
    .run(TEST_LEARNER_ID, "test@example.com", "Test Learner", "github", "12345");

  db = createD1Shim(sqliteDb);

  // Mock fetch globally so Gemini calls don't go out
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "You are making great progress!" }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
  );
});

/* ---- Tests ---- */

describe("GET /api/curriculum/:profile/progress/summary", () => {
  it("returns structured data with empty progress", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/new-grad/progress/summary",
      { headers: { Cookie: cookie } },
      buildTestEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("overall_narrative");
    expect(body.overall_narrative).toBeNull(); // no progress = no narrative
    expect(body).toHaveProperty("sections");
    expect(Array.isArray(body.sections)).toBe(true);
    expect(body).toHaveProperty("stats");
    expect(body.stats.completed).toBe(0);
    expect(body.stats.in_progress).toBe(0);
    expect(body.stats.total).toBeGreaterThan(0);
    expect(body).toHaveProperty("concepts_due_for_review");
    expect(Array.isArray(body.concepts_due_for_review)).toBe(true);
  });

  it("returns stats with all zeros for empty progress", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/new-grad/progress/summary",
      { headers: { Cookie: cookie } },
      buildTestEnv()
    );

    const body = await res.json();

    expect(body.stats.completed).toBe(0);
    expect(body.stats.in_progress).toBe(0);
    expect(body.stats.paused).toBe(0);
    expect(body.stats.not_started).toBe(body.stats.total);
  });

  it("returns correct section breakdown with mock progress data", async () => {
    // Seed progress for a couple of sections
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, started_at, updated_at)
         VALUES (?, ?, ?, 'completed', '[{"understanding_level":"solid"}]', '{"thread safety":{"level":"solid","last_reviewed":"2026-01-01","next_review":"2026-01-08","review_count":2}}', datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "new-grad", "1.1");

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, started_at, updated_at)
         VALUES (?, ?, ?, 'in_progress', '[{"understanding_level":"emerging"}]', '{}', datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "new-grad", "1.2");

    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/new-grad/progress/summary",
      { headers: { Cookie: cookie } },
      buildTestEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.stats.completed).toBe(1);
    expect(body.stats.in_progress).toBe(1);

    // Find the completed section
    const completedSection = body.sections.find(
      (s: { section_id: string }) => s.section_id === "1.1"
    );
    expect(completedSection).toBeTruthy();
    expect(completedSection.status).toBe("completed");
    expect(completedSection.understanding_level).toBe("solid");
    expect(completedSection.concepts["thread safety"]).toBeTruthy();
    expect(completedSection.concepts["thread safety"].level).toBe("solid");

    // Find the in-progress section
    const ipSection = body.sections.find(
      (s: { section_id: string }) => s.section_id === "1.2"
    );
    expect(ipSection).toBeTruthy();
    expect(ipSection.status).toBe("in_progress");

    // Narrative should be present (mocked)
    expect(body.overall_narrative).toBe("You are making great progress!");
  });

  it("returns 400 for invalid profile", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/invalid-profile/progress/summary",
      { headers: { Cookie: cookie } },
      buildTestEnv()
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns null narrative when LLM call fails", async () => {
    // Seed some progress
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, started_at, updated_at)
         VALUES (?, ?, ?, 'in_progress', '[]', '{}', datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "new-grad", "1.1");

    // Override fetch to fail
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/new-grad/progress/summary",
      { headers: { Cookie: cookie } },
      buildTestEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overall_narrative).toBeNull();
    expect(body.stats.in_progress).toBe(1);
  });
});
