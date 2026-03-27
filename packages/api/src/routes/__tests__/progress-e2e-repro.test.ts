/**
 * Reproduction test for progress tracking bug:
 * - User has a Socratic conversation
 * - Goes back to dashboard
 * - No progress shown (should show "in_progress")
 * - Admin panel shows "not started any curricula"
 *
 * Root cause: fire-and-forget DB writes (updateSectionProgress) were not
 * registered with c.executionCtx.waitUntil(), so Cloudflare Workers could
 * terminate the worker before the write completed.
 *
 * These tests verify:
 * 1. The progress write actually completes (functional correctness)
 * 2. The full flow from socratic POST to progress GET works end-to-end
 */

import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import { Hono } from "hono";
import { Database } from "bun:sqlite";
import type { Env } from "../../env";
import type { GeminiFunctionCallResponse } from "../../lib/gemini";
import { ENROLLMENT_TABLES_SQL, seedCurriculumVersions } from "./test-schema";

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
  } as unknown as D1Database;
}

/* ---- Gemini mock ---- */

const SOCRATIC_PROBE_RESPONSE: GeminiFunctionCallResponse = {
  candidates: [
    {
      content: {
        parts: [
          {
            functionCall: {
              name: "socratic_probe",
              args: {
                response: "What do you think about that?",
                topic: "testing",
                confidence_assessment: "medium",
              },
            },
          },
        ],
      },
    },
  ],
};

/* ---- Constants ---- */

const TEST_LEARNER_ID = "test-learner-progress-001";
const TEST_PROFILE = "level-1";
const TEST_SECTION_ID = "1.1";
const FLUSH_DELAY_MS = 100;

function flushFireAndForget(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, FLUSH_DELAY_MS));
}

/* ---- Tests ---- */

describe("progress tracking e2e repro", () => {
  let sqliteDb: InstanceType<typeof Database>;
  let db: D1Database;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    sqliteDb = new Database(":memory:");
    sqliteDb.exec("PRAGMA foreign_keys = ON");

    // Create tables (matching all migrations)
    sqliteDb.exec(`
      CREATE TABLE learners (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
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
        claims_json TEXT DEFAULT '{}',
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
        summary TEXT
      )
    `);

    sqliteDb.exec(ENROLLMENT_TABLES_SQL);
    seedCurriculumVersions(sqliteDb);

    // Seed a test learner (simulating what auth.ts callback does)
    sqliteDb
      .prepare(
        "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)"
      )
      .run(TEST_LEARNER_ID, "test@example.com", "Test Learner", "github", "12345");

    db = createD1Shim(sqliteDb);
  });

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch;
    sqliteDb?.close();
  });

  it("POST /api/socratic creates a curriculum_progress row with in_progress status", async () => {
    originalFetch = globalThis.fetch;

    // Mock Gemini API to return a socratic_probe response
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify(SOCRATIC_PROBE_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )) as unknown as typeof fetch;

    // Import the route and build app with middleware that injects env + learnerId
    const { socraticChat } = await import("../socratic-chat");
    const app = new Hono();
    app.use("*", async (c, next) => {
      (c.env as Env) = {
        DB: db as unknown as Env["DB"],
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "gemini-flash-latest",
      } as Env;
      c.set("learnerId" as never, TEST_LEARNER_ID as never);
      await next();
    });
    app.route("/", socraticChat);

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: TEST_PROFILE,
        section_id: TEST_SECTION_ID,
        message: "hello",
        context: { conversation: [] },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("reply");

    // Wait for fire-and-forget updateSectionProgress to complete
    await flushFireAndForget();

    // ASSERT: a curriculum_progress row should exist with status "in_progress"
    const row = sqliteDb
      .prepare(
        "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION_ID) as Record<string, unknown> | null;

    expect(row).not.toBeNull();
    expect(row!.status).toBe("in_progress");
    expect(row!.started_at).toBeTruthy();
  });

  it("GET /api/curriculum/:profile/progress returns progress after a Socratic interaction", async () => {
    originalFetch = globalThis.fetch;

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify(SOCRATIC_PROBE_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )) as unknown as typeof fetch;

    // Build combined app with both socratic and curriculum routes
    const { socraticChat } = await import("../socratic-chat");
    const { curriculum } = await import("../curriculum");

    const app = new Hono();
    app.use("*", async (c, next) => {
      (c.env as Env) = {
        DB: db as unknown as Env["DB"],
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "gemini-flash-latest",
      } as Env;
      c.set("learnerId" as never, TEST_LEARNER_ID as never);
      await next();
    });
    app.route("/api/socratic", socraticChat);
    app.route("/api/curriculum", curriculum);

    // Step 1: POST to socratic endpoint
    const postRes = await app.request("/api/socratic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: TEST_PROFILE,
        section_id: TEST_SECTION_ID,
        message: "hello",
        context: { conversation: [] },
      }),
    });
    expect(postRes.status).toBe(200);

    // Wait for fire-and-forget
    await flushFireAndForget();

    // Step 2: GET progress
    const progressRes = await app.request(
      `/api/curriculum/${TEST_PROFILE}/progress`,
      { method: "GET" }
    );
    expect(progressRes.status).toBe(200);

    const progress = (await progressRes.json()) as Array<{ section_id: string; status: string }>;

    // ASSERT: should have at least one section with in_progress status
    const section = progress.find((p) => p.section_id === TEST_SECTION_ID);
    expect(section).toBeTruthy();
    expect(section!.status).toBe("in_progress");
  });

  it("calls executionCtx.waitUntil for progress update when available", async () => {
    originalFetch = globalThis.fetch;

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify(SOCRATIC_PROBE_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )) as unknown as typeof fetch;

    // Track waitUntil calls
    const waitUntilCalls: Promise<unknown>[] = [];

    const { socraticChat } = await import("../socratic-chat");

    // Build a custom Hono app that provides executionCtx
    const app = new Hono();
    app.all("*", async (c, next) => {
      (c.env as Env) = {
        DB: db as unknown as Env["DB"],
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "gemini-flash-latest",
      } as Env;
      c.set("learnerId" as never, TEST_LEARNER_ID as never);
      await next();
    });
    app.route("/", socraticChat);

    // Use the lower-level fetch approach to inject executionCtx
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: TEST_PROFILE,
        section_id: TEST_SECTION_ID,
        message: "hello",
        context: { conversation: [] },
      }),
    });

    const res = await app.fetch(req, {}, {
      waitUntil(p: Promise<unknown>) {
        waitUntilCalls.push(p);
      },
      passThroughOnException() {},
    });

    expect(res.status).toBe(200);

    // ASSERT: waitUntil should have been called at least once (for progress update)
    expect(waitUntilCalls.length).toBeGreaterThanOrEqual(1);

    // Wait for the registered promises to settle
    await Promise.allSettled(waitUntilCalls);

    // Verify the progress was actually written
    const row = sqliteDb
      .prepare(
        "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION_ID) as Record<string, unknown> | null;

    expect(row).not.toBeNull();
    expect(row!.status).toBe("in_progress");
  });
});
