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
    CREATE TABLE learners (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      enrolled_at TEXT DEFAULT (datetime('now')),
      selected_profile TEXT,
      auth_provider TEXT,
      auth_subject TEXT,
      last_active_at TEXT
    );
  `);
  sqliteDb.exec(ENROLLMENT_TABLES_SQL);
  seedCurriculumVersions(sqliteDb);
  sqliteDb.exec(
    "INSERT INTO learners (id, email, display_name) VALUES ('test-learner', 'test@example.com', 'Test User')"
  );

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

async function authCookie(learnerId = "test-learner"): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign({ sub: learnerId, iat: now, exp: now + 3600 }, JWT_SECRET);
  return `sp_session=${token}`;
}

/* ---- Tests ---- */

describe("PUT /api/auth/preferences", () => {
  it("saves selected_profile and GET /me returns it", async () => {
    const cookie = await authCookie();

    const putRes = await app.request(
      "/api/auth/preferences",
      {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ selected_profile: "level-1" }),
      },
      TEST_ENV,
    );

    expect(putRes.status).toBe(200);
    const putBody = await putRes.json() as { ok: boolean };
    expect(putBody.ok).toBe(true);

    // Verify via GET /me
    const meRes = await app.request(
      "/api/auth/me",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json() as { selected_profile: string };
    expect(meBody.selected_profile).toBe("level-1");
  });

  it("rejects invalid profile with 400", async () => {
    const cookie = await authCookie();

    const res = await app.request(
      "/api/auth/preferences",
      {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ selected_profile: "invalid-track" }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Invalid profile");
  });

  it("returns 401 without auth cookie", async () => {
    const res = await app.request(
      "/api/auth/preferences",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_profile: "level-1" }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
  });

  it("GET /me returns null selected_profile when not set", async () => {
    const cookie = await authCookie();

    const res = await app.request(
      "/api/auth/me",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { selected_profile: string | null };
    expect(body.selected_profile).toBeNull();
  });

  it("overwrites previous preference", async () => {
    const cookie = await authCookie();

    // Set first preference
    await app.request(
      "/api/auth/preferences",
      {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ selected_profile: "level-1" }),
      },
      TEST_ENV,
    );

    // Overwrite with second preference
    await app.request(
      "/api/auth/preferences",
      {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ selected_profile: "level-10" }),
      },
      TEST_ENV,
    );

    // Verify the latest preference
    const meRes = await app.request(
      "/api/auth/me",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );
    const body = await meRes.json() as { selected_profile: string };
    expect(body.selected_profile).toBe("level-10");
  });
});

/* ---- Task 68.9: Validation unit tests ---- */

describe("Profile validation", () => {
  it("accepts all valid profiles", async () => {
    const cookie = await authCookie();
    const validProfiles = ["level-0", "level-1", "level-10", "level-20"];

    for (const profile of validProfiles) {
      const res = await app.request(
        "/api/auth/preferences",
        {
          method: "PUT",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ selected_profile: profile }),
        },
        TEST_ENV,
      );
      expect(res.status).toBe(200);
    }
  });

  it("rejects profiles that look similar but are invalid", async () => {
    const cookie = await authCookie();
    const invalidProfiles = ["level-2", "Level-1", "LEVEL-0", "level0", ""];

    for (const profile of invalidProfiles) {
      const res = await app.request(
        "/api/auth/preferences",
        {
          method: "PUT",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ selected_profile: profile }),
        },
        TEST_ENV,
      );
      expect(res.status).toBe(400);
    }
  });
});
