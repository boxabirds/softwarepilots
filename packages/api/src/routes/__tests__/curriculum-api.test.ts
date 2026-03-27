import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { sign } from "hono/jwt";
import { Database } from "bun:sqlite";
import app from "../../index";
import { ENROLLMENT_TABLES_SQL, seedCurriculumVersions } from "./test-schema";

/* ---- D1 shim ---- */

function createD1Shim(sqliteDb: InstanceType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) { bindings = values; return this; },
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
          return { results: rows, success: true, meta: {} as D1Result<T>["meta"] };
        },
        async run(): Promise<D1Response> {
          const stmt = sqliteDb.prepare(query);
          const info = stmt.run(...bindings);
          return { success: true, meta: { duration: 0, changes: info.changes, last_row_id: info.lastInsertRowid as number, changed_db: info.changes > 0, size_after: 0, rows_read: 0, rows_written: info.changes } };
        },
      } as unknown as D1PreparedStatement;
    },
    async batch<T>(): Promise<D1Result<T>[]> { throw new Error("not implemented"); },
    async dump(): Promise<ArrayBuffer> { throw new Error("not implemented"); },
    async exec(): Promise<D1ExecResult> { throw new Error("not implemented"); },
  } as unknown as D1Database;
}

/* ---- Shared env and auth helper ---- */

const JWT_SECRET = "test-secret-at-least-32-chars-long";

let sqliteDb: InstanceType<typeof Database>;
let TEST_ENV: Record<string, unknown>;

beforeEach(() => {
  sqliteDb = new Database(":memory:");
  sqliteDb.exec("PRAGMA foreign_keys = OFF");
  sqliteDb.exec(`
    CREATE TABLE learners (id TEXT PRIMARY KEY, display_name TEXT);
    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL, profile TEXT NOT NULL, section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started', understanding_json TEXT,
      concepts_json TEXT, claims_json TEXT, started_at TEXT, completed_at TEXT,
      paused_at TEXT, updated_at TEXT,
      PRIMARY KEY (learner_id, profile, section_id)
    );
  `);
  sqliteDb.exec(ENROLLMENT_TABLES_SQL);
  seedCurriculumVersions(sqliteDb);
  sqliteDb.exec("INSERT OR IGNORE INTO learners (id, display_name) VALUES ('test-learner', 'Test')");

  TEST_ENV = {
    ENVIRONMENT: "local",
    JWT_SECRET,
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
    WEB_APP_URL: "http://localhost:3000",
    GEMINI_API_KEY: "test",
    DB: createD1Shim(sqliteDb),
  };
});

afterEach(() => { sqliteDb?.close(); });

async function authCookie(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign({ sub: "test-learner", iat: now, exp: now + 3600 }, JWT_SECRET);
  return `sp_session=${token}`;
}

/* ---- Tests ---- */

describe("Curriculum API endpoints", () => {
  it("GET /api/curriculum returns array of 4 profiles", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(4);
    expect(body.map((p: { profile: string }) => p.profile).sort()).toEqual([
      "level-0",
      "level-1",
      "level-10",
      "level-20",
    ]);
  });

  it("GET /api/curriculum/level-1 returns sections array", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // Each section should have expected fields
    const first = body[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("module_id");
    expect(first).toHaveProperty("module_title");
  });

  it("GET /api/curriculum/level-1/1.1 returns section with markdown", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/1.1",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toHaveProperty("id", "1.1");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("markdown");
    expect(typeof body.markdown).toBe("string");
    expect(body.markdown.length).toBeGreaterThan(0);
  });

  it("GET /api/curriculum/unknown returns 404", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/unknown",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("GET /api/curriculum/level-1/99.99 returns 404", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/99.99",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toHaveProperty("error");
  });
});
