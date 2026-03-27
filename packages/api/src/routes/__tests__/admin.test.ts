import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { ENROLLMENT_TABLES_SQL, seedCurriculumVersions, seedPrompts } from "./test-schema";

/* ---- D1Database shim using bun:sqlite ---- */

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
  } as unknown as D1Database;
}

/* ---- Test fixtures ---- */

const TEST_LEARNER_ID = "learner-001";
const TEST_LEARNER_NAME = "Alice";
const TEST_ADMIN_KEY = "test-admin-key-for-tests";

let sqliteDb: InstanceType<typeof Database>;
let app: InstanceType<typeof Hono>;

function authHeader(token: string = TEST_ADMIN_KEY): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

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
    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      understanding_json TEXT,
      started_at TEXT,
      updated_at TEXT,
      concepts_json TEXT DEFAULT '{}',
      paused_at TEXT,
      completed_at TEXT,
      claims_json TEXT DEFAULT '{}',
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
      summary TEXT
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

  sqliteDb.exec(ENROLLMENT_TABLES_SQL);
  seedCurriculumVersions(sqliteDb);
  seedPrompts(sqliteDb);

  sqliteDb
    .prepare(
      "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)"
    )
    .run(TEST_LEARNER_ID, "alice@example.com", TEST_LEARNER_NAME, "github", "gh-123");

  const db = createD1Shim(sqliteDb);

  // Import and mount the admin router
  const { admin } = await import("../admin");
  app = new Hono();
  // Inject env bindings including ADMIN_API_KEY
  app.use("*", async (c, next) => {
    c.env = { DB: db, ADMIN_API_KEY: TEST_ADMIN_KEY, GEMINI_API_KEY: "test-gemini-key" } as never;
    await next();
  });
  app.route("/api/admin", admin);
});

/* ---- Bearer auth tests ---- */

describe("Admin bearer auth", () => {
  it("returns 401 when no Authorization header is provided", async () => {
    const res = await app.request("/api/admin/feedback");
    expect(res.status).toBe(401);
  });

  it("returns 401 when Bearer token is invalid", async () => {
    const res = await app.request("/api/admin/feedback", {
      headers: authHeader("wrong-key"),
    });
    expect(res.status).toBe(401);
  });

  it("rejects empty Bearer token", async () => {
    const res = await app.request("/api/admin/feedback", {
      headers: { Authorization: "Bearer " },
    });
    // Hono bearerAuth returns 400 for malformed tokens
    expect(res.ok).toBe(false);
  });

  it("rejects wrong auth scheme", async () => {
    const res = await app.request("/api/admin/feedback", {
      headers: { Authorization: `Basic ${TEST_ADMIN_KEY}` },
    });
    expect(res.ok).toBe(false);
  });

  it("returns 200 with valid Bearer token", async () => {
    const res = await app.request("/api/admin/feedback", {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
  });

  it("protects DELETE routes too", async () => {
    const res = await app.request("/api/admin/feedback/1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});

/* ---- Authenticated admin endpoint tests ---- */

describe("GET /api/admin/feedback (authenticated)", () => {
  it("returns empty array when no feedback exists", async () => {
    const res = await app.request("/api/admin/feedback", {
      headers: authHeader(),
    });
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

    const res = await app.request("/api/admin/feedback", {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(data).toHaveLength(2);
    expect(data[0].learner_name).toBe(TEST_LEARNER_NAME);
    expect(data[0].profile).toBe("level-1");
    expect(data[0].feedback_text).toBeTruthy();
    expect(data[1].learner_name).toBe(TEST_LEARNER_NAME);
  });
});

describe("DELETE /api/admin/feedback/:id (authenticated)", () => {
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
      headers: authHeader(),
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
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBeTruthy();
  });
});

/* ---- GET /api/admin/users ---- */

describe("GET /api/admin/users (authenticated)", () => {
  it("returns learners with empty profiles when no progress exists", async () => {
    const res = await app.request("/api/admin/users", {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(TEST_LEARNER_ID);
    expect(data[0].display_name).toBe(TEST_LEARNER_NAME);
    expect(data[0].profiles).toEqual([]);
  });

  it("returns profile summaries when learner has progress", async () => {
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "level-0", "1.1", "in_progress");
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "level-0", "1.2", "completed");

    const res = await app.request("/api/admin/users", {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);

    const profiles = data[0].profiles as Array<Record<string, unknown>>;
    expect(profiles.length).toBeGreaterThanOrEqual(1);
    const level0 = profiles.find((p) => p.profile === "level-0");
    expect(level0).toBeDefined();
    expect(level0!.sections_started).toBe(1);
    expect(level0!.sections_completed).toBe(1);
    expect(typeof level0!.total_sections).toBe("number");
    expect(typeof level0!.claim_percentage).toBe("number");
  });

  it("skips not_started rows from profile inclusion", async () => {
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "level-0", "1.1", "not_started");

    const res = await app.request("/api/admin/users", {
      headers: authHeader(),
    });
    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect((data[0].profiles as unknown[]).length).toBe(0);
  });

  it("requires auth", async () => {
    const res = await app.request("/api/admin/users");
    expect(res.status).toBe(401);
  });
});

/* ---- GET /api/admin/users/:learnerId/progress ---- */

describe("GET /api/admin/users/:learnerId/progress (authenticated)", () => {
  it("returns 404 for non-existent learner", async () => {
    const res = await app.request("/api/admin/users/nonexistent/progress", {
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("Learner not found");
  });

  it("returns learner info with empty profiles when no progress", async () => {
    const res = await app.request(`/api/admin/users/${TEST_LEARNER_ID}/progress`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect((data.learner as Record<string, unknown>).id).toBe(TEST_LEARNER_ID);
    expect((data.learner as Record<string, unknown>).display_name).toBe(TEST_LEARNER_NAME);
    expect(data.profiles).toEqual([]);
  });

  it("returns progress sections for active profiles", async () => {
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "level-0", "1.1", "in_progress", "[]");

    const res = await app.request(`/api/admin/users/${TEST_LEARNER_ID}/progress`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    const profiles = data.profiles as Array<Record<string, unknown>>;
    expect(profiles.length).toBeGreaterThanOrEqual(1);

    const level0 = profiles.find((p) => p.profile === "level-0");
    expect(level0).toBeDefined();
    expect(level0!.title).toBeTruthy();
    const sections = level0!.sections as Array<Record<string, unknown>>;
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections[0].section_id).toBe("1.1");
    expect(sections[0].status).toBe("in_progress");
  });

  it("returns claim_progress when section has a learning map with core claims", async () => {
    // Section 0.1 in level-0 has core_claims (claim-1, claim-2, etc.)
    const claimsJson = JSON.stringify({
      "claim-1": { level: "developing", timestamp: "2026-03-22T10:00:00Z" },
      "claim-2": { level: "solid", timestamp: "2026-03-22T10:05:00Z" },
    });
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, claims_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(TEST_LEARNER_ID, "level-0", "0.1", "in_progress", "[]", claimsJson);

    const res = await app.request(`/api/admin/users/${TEST_LEARNER_ID}/progress`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    const profiles = data.profiles as Array<Record<string, unknown>>;
    const level0 = profiles.find((p) => p.profile === "level-0");
    expect(level0).toBeDefined();

    const sections = level0!.sections as Array<Record<string, unknown>>;
    const sec01 = sections.find((s) => s.section_id === "0.1");
    expect(sec01).toBeDefined();

    const cp = sec01!.claim_progress as Record<string, unknown>;
    expect(cp).toBeDefined();
    expect(typeof cp.demonstrated).toBe("number");
    expect(typeof cp.total).toBe("number");
    expect(typeof cp.percentage).toBe("number");
    expect(Array.isArray(cp.missing)).toBe(true);
    // We set 2 claims as demonstrated; total depends on the real learning map
    expect(cp.demonstrated).toBe(2);
    expect((cp.total as number)).toBeGreaterThanOrEqual(2);
  });

  it("requires auth", async () => {
    const res = await app.request(`/api/admin/users/${TEST_LEARNER_ID}/progress`);
    expect(res.status).toBe(401);
  });
});

/* ---- GET /api/admin/users/:learnerId/conversations/:profile/:sectionId ---- */

describe("GET /api/admin/users/:learnerId/conversations/:profile/:sectionId (authenticated)", () => {
  it("returns 404 for non-existent learner", async () => {
    const res = await app.request("/api/admin/users/nonexistent/conversations/level-0/1.1", {
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
  });

  it("returns empty conversations array when none exist", async () => {
    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/conversations/level-0/1.1`,
      { headers: authHeader() }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.conversations).toEqual([]);
  });

  it("returns parsed conversation messages", async () => {
    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run("conv-001", TEST_LEARNER_ID, "level-0", "1.1", JSON.stringify(messages));

    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/conversations/level-0/1.1`,
      { headers: authHeader() }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { conversations: Array<Record<string, unknown>> };
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0].id).toBe("conv-001");
    expect(data.conversations[0].messages).toEqual(messages);
    expect(data.conversations[0].summary).toBeNull();
    expect(data.conversations[0].archived_at).toBeNull();
  });

  it("returns archived and active conversations together", async () => {
    const msgs = JSON.stringify([{ role: "user", content: "test" }]);
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, archived_at, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run("conv-old", TEST_LEARNER_ID, "level-0", "1.1", msgs, "2026-01-01T00:00:00Z", "Old summary");
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run("conv-new", TEST_LEARNER_ID, "level-0", "1.1", msgs);

    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/conversations/level-0/1.1`,
      { headers: authHeader() }
    );
    const data = (await res.json()) as { conversations: Array<Record<string, unknown>> };
    expect(data.conversations).toHaveLength(2);

    const archived = data.conversations.find((c) => c.id === "conv-old");
    expect(archived!.archived_at).toBe("2026-01-01T00:00:00Z");
    expect(archived!.summary).toBe("Old summary");
  });

  it("requires auth", async () => {
    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/conversations/level-0/1.1`
    );
    expect(res.status).toBe(401);
  });
});

/* ---- GET /api/admin/users/:learnerId/section-events/:profile/:sectionId ---- */

describe("GET /api/admin/users/:learnerId/section-events/:profile/:sectionId (authenticated)", () => {
  it("returns 404 for non-existent learner", async () => {
    const res = await app.request("/api/admin/users/nonexistent/section-events/level-0/1.1", {
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
  });

  it("returns not_started defaults when no progress exists", async () => {
    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/section-events/level-0/1.1`,
      { headers: authHeader() }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe("not_started");
    expect(data.understanding_json).toBe("[]");
    expect(data.claims_json).toBe("{}");
    expect(data.concepts_json).toBe("{}");
    expect(data.started_at).toBeNull();
    expect(data.completed_at).toBeNull();
    expect(data.paused_at).toBeNull();
  });

  it("returns raw progress data when section has progress", async () => {
    const understandingJson = JSON.stringify([
      { understanding_level: "developing", confidence_assessment: "medium", timestamp: "2026-03-22T10:00:00Z" },
      { understanding_level: "solid", confidence_assessment: "high", timestamp: "2026-03-22T10:05:00Z" },
    ]);
    const claimsJson = JSON.stringify({
      "claim-1": { level: "developing", timestamp: "2026-03-22T10:02:00Z" },
    });
    const conceptsJson = JSON.stringify({
      "variables": { level: "developing", review_count: 2, next_review: "2026-03-25T00:00:00Z" },
    });

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, claims_json, concepts_json, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        TEST_LEARNER_ID, "level-0", "1.1", "in_progress",
        understandingJson, claimsJson, conceptsJson, "2026-03-22T09:55:00Z"
      );

    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/section-events/level-0/1.1`,
      { headers: authHeader() }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe("in_progress");
    expect(data.started_at).toBe("2026-03-22T09:55:00Z");
    expect(data.completed_at).toBeNull();
    expect(data.paused_at).toBeNull();

    // Verify raw JSON is returned as strings
    const parsedUnderstanding = JSON.parse(data.understanding_json as string);
    expect(parsedUnderstanding).toHaveLength(2);
    expect(parsedUnderstanding[0].understanding_level).toBe("developing");

    const parsedClaims = JSON.parse(data.claims_json as string);
    expect(parsedClaims["claim-1"].level).toBe("developing");

    const parsedConcepts = JSON.parse(data.concepts_json as string);
    expect(parsedConcepts["variables"].level).toBe("developing");
  });

  it("returns completed section data with final_understanding", async () => {
    const understandingJson = JSON.stringify([
      { understanding_level: "developing", timestamp: "2026-03-22T10:00:00Z" },
      { final_understanding: "solid", concepts_covered: ["loops", "arrays"], timestamp: "2026-03-22T10:30:00Z" },
    ]);

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, started_at, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        TEST_LEARNER_ID, "level-0", "1.1", "completed",
        understandingJson, "2026-03-22T09:55:00Z", "2026-03-22T10:30:00Z"
      );

    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/section-events/level-0/1.1`,
      { headers: authHeader() }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe("completed");
    expect(data.completed_at).toBe("2026-03-22T10:30:00Z");

    const parsedUnderstanding = JSON.parse(data.understanding_json as string);
    expect(parsedUnderstanding[1].final_understanding).toBe("solid");
    expect(parsedUnderstanding[1].concepts_covered).toEqual(["loops", "arrays"]);
  });

  it("returns paused section data with pause_reason", async () => {
    const understandingJson = JSON.stringify([
      { pause_reason: "learner_requested", resume_suggestion: "review variables", timestamp: "2026-03-22T10:15:00Z" },
    ]);

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, started_at, paused_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        TEST_LEARNER_ID, "level-0", "1.1", "paused",
        understandingJson, "2026-03-22T09:55:00Z", "2026-03-22T10:15:00Z"
      );

    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/section-events/level-0/1.1`,
      { headers: authHeader() }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe("paused");
    expect(data.paused_at).toBe("2026-03-22T10:15:00Z");

    const parsedUnderstanding = JSON.parse(data.understanding_json as string);
    expect(parsedUnderstanding[0].pause_reason).toBe("learner_requested");
  });

  it("requires auth", async () => {
    const res = await app.request(
      `/api/admin/users/${TEST_LEARNER_ID}/section-events/level-0/1.1`
    );
    expect(res.status).toBe(401);
  });
});

/* ---- POST /api/admin/curriculum/:profile/versions - learning map auto-generation ---- */

import type { SectionLearningMap } from "@softwarepilots/shared";

const VALID_LEARNING_MAP: SectionLearningMap = {
  section_id: "0.1",
  generated_at: "2026-03-27T00:00:00Z",
  model_used: "gemini-2.0-flash",
  prerequisites: [],
  core_claims: [
    { id: "claim-1", statement: "Servers respond to requests", concepts: ["Server"], demonstration_criteria: "Can explain server request handling" },
    { id: "claim-2", statement: "Databases store data", concepts: ["Database"], demonstration_criteria: "Can identify persistent storage needs" },
    { id: "claim-3", statement: "Both are infrastructure", concepts: ["Server", "Database"], demonstration_criteria: "Can describe how they work together" },
  ],
  key_misconceptions: [
    { id: "misconception-1", belief: "Servers never fail", correction: "Servers have limited resources", related_claims: ["claim-1"] },
  ],
  key_intuition_decomposition: [
    { id: "insight-1", statement: "Naming enables reasoning", order: 1 },
    { id: "insight-2", statement: "Reasoning enables accountability", order: 2 },
  ],
};

const MINI_CURRICULUM = JSON.stringify({
  meta: { profile: "level-0", title: "Level 0", starting_position: "Beginner" },
  modules: [{
    id: "1",
    title: "Basics",
    sections: [{ id: "0.1", title: "Vocab", key_intuition: "Name things", markdown: "## Vocab\n\n**Server**: a computer.\n\n**Database**: stores data." }],
  }],
});

describe("POST /api/admin/curriculum/:profile/versions - learning map generation", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockGeminiForMap(map: SectionLearningMap) {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(map) }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )) as unknown as typeof fetch;
  }

  it("publishes version and triggers background learning map generation", async () => {
    mockGeminiForMap(VALID_LEARNING_MAP);

    const waitUntilCalls: Promise<unknown>[] = [];
    const res = await app.fetch(
      new Request("http://localhost/api/admin/curriculum/level-0/versions", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          content_json: MINI_CURRICULUM,
          content_hash: "test-hash-auto-gen",
          created_by: "test",
          reason: "test auto-gen",
        }),
      }),
      {},
      {
        waitUntil(p: Promise<unknown>) { waitUntilCalls.push(p); },
        passThroughOnException() {},
      },
    );

    expect(res.status).toBe(201);
    expect(waitUntilCalls.length).toBeGreaterThanOrEqual(1);

    // Wait for background generation to complete
    await Promise.allSettled(waitUntilCalls);

    // Verify learning map was stored in DB
    const row = sqliteDb.prepare(
      "SELECT map_json FROM learning_maps WHERE profile = ? AND section_id = ?"
    ).get("level-0", "0.1") as { map_json: string } | null;

    expect(row).not.toBeNull();
    const stored = JSON.parse(row!.map_json) as SectionLearningMap;
    expect(stored.section_id).toBe("0.1");
    expect(stored.core_claims).toHaveLength(3);
  });

  it("skips generation when learning map already exists for content hash", async () => {
    let geminiCallCount = 0;
    globalThis.fetch = (() => {
      geminiCallCount++;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_LEARNING_MAP) }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }) as unknown as typeof fetch;

    // First publish - generates map
    const waitUntil1: Promise<unknown>[] = [];
    await app.fetch(
      new Request("http://localhost/api/admin/curriculum/level-0/versions", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          content_json: MINI_CURRICULUM,
          content_hash: "hash-skip-test-1",
          created_by: "test",
          reason: "first publish",
        }),
      }),
      {},
      { waitUntil(p: Promise<unknown>) { waitUntil1.push(p); }, passThroughOnException() {} },
    );
    await Promise.allSettled(waitUntil1);
    expect(geminiCallCount).toBe(1);

    // Second publish with same content - should skip
    geminiCallCount = 0;
    const waitUntil2: Promise<unknown>[] = [];
    await app.fetch(
      new Request("http://localhost/api/admin/curriculum/level-0/versions", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          content_json: MINI_CURRICULUM,
          content_hash: "hash-skip-test-2",
          created_by: "test",
          reason: "second publish same content",
        }),
      }),
      {},
      { waitUntil(p: Promise<unknown>) { waitUntil2.push(p); }, passThroughOnException() {} },
    );
    await Promise.allSettled(waitUntil2);
    expect(geminiCallCount).toBe(0);
  });

  it("publish succeeds even when Gemini fails", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 }))
    ) as unknown as typeof fetch;

    const waitUntilCalls: Promise<unknown>[] = [];
    const res = await app.fetch(
      new Request("http://localhost/api/admin/curriculum/level-0/versions", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          content_json: MINI_CURRICULUM,
          content_hash: "hash-gemini-fail",
          created_by: "test",
          reason: "test gemini failure",
        }),
      }),
      {},
      { waitUntil(p: Promise<unknown>) { waitUntilCalls.push(p); }, passThroughOnException() {} },
    );

    // Publish itself succeeds
    expect(res.status).toBe(201);
    await Promise.allSettled(waitUntilCalls);

    // No learning map stored
    const row = sqliteDb.prepare(
      "SELECT COUNT(*) as cnt FROM learning_maps WHERE profile = 'level-0'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});
