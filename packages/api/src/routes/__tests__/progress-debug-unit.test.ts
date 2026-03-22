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

/* ---- Constants ---- */

const JWT_SECRET = "test-secret-at-least-32-chars-long";
const TEST_LEARNER_ID = "unit-test-learner";

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
    .run(TEST_LEARNER_ID, "unit@example.com", "Unit Learner", "github", "88888");

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

/* ---- Helper to call the debug endpoint ---- */

async function fetchDebug(profile: string, learnerId?: string) {
  const cookie = await authCookie(learnerId);
  const res = await app.request(
    `/api/curriculum/${profile}/progress/debug`,
    { headers: { Cookie: cookie } },
    testEnv,
  );
  return { status: res.status, body: await res.json() as any };
}

/* ---- Unit tests: response shape ---- */

describe("Diagnostic endpoint response shape", () => {
  it("includes learner_exists as a boolean", async () => {
    const { body } = await fetchDebug("level-1");
    expect(typeof body.learner_exists).toBe("boolean");
    expect(body.learner_exists).toBe(true);
  });

  it("includes table_columns as an array of strings", async () => {
    const { body } = await fetchDebug("level-1");
    expect(Array.isArray(body.table_columns)).toBe(true);
    expect(body.table_columns.length).toBeGreaterThan(0);
    for (const col of body.table_columns) {
      expect(typeof col).toBe("string");
    }
  });

  it("includes progress_rows as an array", async () => {
    const { body } = await fetchDebug("level-1");
    expect(Array.isArray(body.progress_rows)).toBe(true);
  });

  it("includes expected_section_count as a number", async () => {
    const { body } = await fetchDebug("level-1");
    expect(typeof body.expected_section_count).toBe("number");
    expect(body.expected_section_count).toBeGreaterThan(0);
  });

  it("includes summary with not_started, in_progress, completed, and paused counts", async () => {
    const { body } = await fetchDebug("level-1");
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.not_started).toBe("number");
    expect(typeof body.summary.in_progress).toBe("number");
    expect(typeof body.summary.completed).toBe("number");
    expect(typeof body.summary.paused).toBe("number");
  });

  it("summary counts match progress_rows when rows exist", async () => {
    // Insert mixed progress rows
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

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, started_at, paused_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "level-1", "1.3", "paused");

    const { body } = await fetchDebug("level-1");

    // Count statuses from rows directly
    const rowCounts = { in_progress: 0, completed: 0, paused: 0 };
    for (const row of body.progress_rows) {
      if (row.status === "in_progress") rowCounts.in_progress++;
      else if (row.status === "completed") rowCounts.completed++;
      else if (row.status === "paused") rowCounts.paused++;
    }

    expect(body.summary.in_progress).toBe(rowCounts.in_progress);
    expect(body.summary.completed).toBe(rowCounts.completed);
    expect(body.summary.paused).toBe(rowCounts.paused);

    // not_started = expected - (in_progress + completed + paused)
    const tracked = rowCounts.in_progress + rowCounts.completed + rowCounts.paused;
    expect(body.summary.not_started).toBe(body.expected_section_count - tracked);
  });

  it("summary counts are zero when no progress rows exist", async () => {
    const { body } = await fetchDebug("level-1");

    expect(body.progress_rows).toHaveLength(0);
    expect(body.summary.in_progress).toBe(0);
    expect(body.summary.completed).toBe(0);
    expect(body.summary.paused).toBe(0);
    expect(body.summary.not_started).toBe(body.expected_section_count);
  });
});
