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
    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL, profile TEXT NOT NULL, section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started', understanding_json TEXT,
      concepts_json TEXT, claims_json TEXT, started_at TEXT, completed_at TEXT,
      paused_at TEXT, updated_at TEXT,
      PRIMARY KEY (learner_id, profile, section_id)
    );
    CREATE TABLE curriculum_conversations (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL,
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      summary TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      archived_at TEXT
    );
  `);
  sqliteDb.exec(ENROLLMENT_TABLES_SQL);
  seedCurriculumVersions(sqliteDb);
  sqliteDb.exec(
    "INSERT INTO learners (id, email, display_name) VALUES ('test-learner', 'test@example.com', 'Test User')"
  );
  sqliteDb.exec(
    "INSERT INTO learners (id, email, display_name) VALUES ('other-learner', 'other@example.com', 'Other User')"
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

describe("GET /:profile/:sectionId/sessions", () => {
  it("returns empty array when no conversations exist", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/1.1/sessions",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it("returns active conversation with status 'active'", async () => {
    const messages = [{ role: "tutor", content: "Hello!" }];
    sqliteDb.exec(
      `INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, created_at, updated_at)
       VALUES ('conv-1', 'test-learner', 'level-1', '1.1', '${JSON.stringify(messages)}', '2026-03-20T10:00:00', '2026-03-20T10:05:00')`
    );

    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/1.1/sessions",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: string; status: string; archived_at: string | null }>;
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("active");
    expect(body[0].archived_at).toBeNull();
  });

  it("returns archived conversations with status 'archived'", async () => {
    const messages = [{ role: "tutor", content: "Done." }];
    sqliteDb.exec(
      `INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, created_at, updated_at, archived_at)
       VALUES ('conv-archived', 'test-learner', 'level-1', '1.1', '${JSON.stringify(messages)}', '2026-03-18T10:00:00', '2026-03-18T11:00:00', '2026-03-18T12:00:00')`
    );

    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/1.1/sessions",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: string; status: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("archived");
  });

  it("orders newest first", async () => {
    sqliteDb.exec(`
      INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, created_at, updated_at)
      VALUES ('conv-old', 'test-learner', 'level-1', '1.1', '[]', '2026-03-18T10:00:00', '2026-03-18T10:00:00');
      INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, created_at, updated_at)
      VALUES ('conv-new', 'test-learner', 'level-1', '1.1', '[]', '2026-03-20T10:00:00', '2026-03-20T10:00:00');
    `);

    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/1.1/sessions",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    const body = await res.json() as Array<{ id: string }>;
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("conv-new");
    expect(body[1].id).toBe("conv-old");
  });

  it("returns correct message_count from messages_json", async () => {
    const messages = [
      { role: "tutor", content: "Hello!" },
      { role: "user", content: "Hi there" },
      { role: "tutor", content: "Good question." },
    ];
    sqliteDb.exec(
      `INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, created_at, updated_at)
       VALUES ('conv-counted', 'test-learner', 'level-1', '1.1', '${JSON.stringify(messages)}', '2026-03-20T10:00:00', '2026-03-20T10:05:00')`
    );

    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/1.1/sessions",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    const body = await res.json() as Array<{ message_count: number }>;
    expect(body[0].message_count).toBe(3);
  });

  it("only returns conversations for authenticated learner", async () => {
    // Insert conversations for two different learners
    sqliteDb.exec(`
      INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, created_at, updated_at)
      VALUES ('conv-mine', 'test-learner', 'level-1', '1.1', '[]', '2026-03-20T10:00:00', '2026-03-20T10:00:00');
      INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, created_at, updated_at)
      VALUES ('conv-theirs', 'other-learner', 'level-1', '1.1', '[]', '2026-03-20T10:00:00', '2026-03-20T10:00:00');
    `);

    const cookie = await authCookie("test-learner");
    const res = await app.request(
      "/api/curriculum/level-1/1.1/sessions",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    const body = await res.json() as Array<{ id: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("conv-mine");
  });
});

/* ---- Task 68.9: message_count from corrupt messages_json ---- */

describe("Session history validation", () => {
  it("message_count from corrupt messages_json returns 0", async () => {
    sqliteDb.exec(
      `INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, created_at, updated_at)
       VALUES ('conv-corrupt', 'test-learner', 'level-1', '1.1', 'not-valid-json{{{', '2026-03-20T10:00:00', '2026-03-20T10:00:00')`
    );

    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/1.1/sessions",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ message_count: number }>;
    expect(body).toHaveLength(1);
    expect(body[0].message_count).toBe(0);
  });
});
