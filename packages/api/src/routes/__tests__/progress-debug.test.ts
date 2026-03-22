import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { sign } from "hono/jwt";
import app from "../../index";

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
    async batch<T>(): Promise<D1Result<T>[]> {
      throw new Error("not implemented");
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error("not implemented");
    },
    async exec(): Promise<D1ExecResult> {
      throw new Error("not implemented");
    },
  } as unknown as D1Database;
}

/* ---- Shared env and auth helper ---- */

const JWT_SECRET = "test-secret-at-least-32-chars-long";
const TEST_LEARNER_ID = "debug-test-learner";

let sqliteDb: InstanceType<typeof Database>;
let testEnv: Record<string, unknown>;

async function authCookie(sub = TEST_LEARNER_ID): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign({ sub, iat: now, exp: now + 3600 }, JWT_SECRET);
  return `sp_session=${token}`;
}

beforeEach(() => {
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

  sqliteDb
    .prepare(
      "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)"
    )
    .run(TEST_LEARNER_ID, "debug@example.com", "Debug Learner", "github", "99999");

  testEnv = {
    ENVIRONMENT: "local",
    JWT_SECRET,
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
    WEB_APP_URL: "http://localhost:3000",
    GEMINI_API_KEY: "test",
    DB: createD1Shim(sqliteDb),
  };
});

/* ---- Tests ---- */

describe("GET /api/curriculum/:profile/progress/debug", () => {
  it("returns diagnostic info for valid profile with no progress", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/progress/debug",
      { headers: { Cookie: cookie } },
      testEnv,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(body.learner_exists).toBe(true);
    expect(body.learner_id).toBe(TEST_LEARNER_ID);
    expect(body.profile).toBe("level-1");
    expect(Array.isArray(body.table_columns)).toBe(true);
    expect(body.table_columns.length).toBeGreaterThan(0);
    expect(body.table_columns).toContain("concepts_json");
    expect(body.table_columns).toContain("completed_at");
    expect(body.progress_rows).toEqual([]);
    expect(body.actual_progress_count).toBe(0);
    expect(body.expected_section_count).toBeGreaterThan(0);
    expect(body.summary.not_started).toBe(body.expected_section_count);
    expect(body.summary.in_progress).toBe(0);
    expect(body.summary.completed).toBe(0);
    expect(body.summary.paused).toBe(0);
  });

  it("returns progress rows when progress exists", async () => {
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, started_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "level-1", "1.1", "in_progress");

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, started_at, completed_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "level-1", "1.2", "completed");

    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/progress/debug",
      { headers: { Cookie: cookie } },
      testEnv,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(body.actual_progress_count).toBe(2);
    expect(body.progress_rows).toHaveLength(2);
    expect(body.summary.in_progress).toBe(1);
    expect(body.summary.completed).toBe(1);
    expect(body.summary.not_started).toBe(body.expected_section_count - 2);
  });

  it("returns learner_exists=false for unknown learner", async () => {
    const cookie = await authCookie("nonexistent-learner");
    const res = await app.request(
      "/api/curriculum/level-1/progress/debug",
      { headers: { Cookie: cookie } },
      testEnv,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.learner_exists).toBe(false);
    expect(body.learner_id).toBe("nonexistent-learner");
  });

  it("returns 400 for invalid profile", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/invalid-profile/progress/debug",
      { headers: { Cookie: cookie } },
      testEnv,
    );

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.request(
      "/api/curriculum/level-1/progress/debug",
      {},
      testEnv,
    );

    expect(res.status).toBe(401);
  });
});
