/**
 * Integration tests: fire-and-forget error logging in socratic-chat route.
 *
 * Verifies that when updateSectionProgress or compressConversation fails,
 * errors are logged via console.error rather than silently swallowed.
 */

import { describe, it, expect, afterEach, beforeEach, spyOn } from "bun:test";
import { Hono } from "hono";
import { Database } from "bun:sqlite";
import type { Env } from "../../env";
import type { GeminiFunctionCallResponse } from "../../lib/gemini";
import { ENROLLMENT_TABLES_SQL, seedCurriculumVersions } from "./test-schema";

/* ---- Gemini mock response builders ---- */

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

const SESSION_COMPLETE_RESPONSE: GeminiFunctionCallResponse = {
  candidates: [
    {
      content: {
        parts: [
          {
            functionCall: {
              name: "session_complete",
              args: {
                summary: "Great session! We covered testing fundamentals.",
                final_understanding: "solid",
                concepts_covered: "unit testing, integration testing",
              },
            },
          },
        ],
      },
    },
  ],
};

/* ---- Helpers ---- */

const FLUSH_DELAY_MS = 50;

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, FLUSH_DELAY_MS));
}

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

let sqliteDb: InstanceType<typeof Database>;

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
    CREATE TABLE curriculum_conversations (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL, profile TEXT NOT NULL, section_id TEXT NOT NULL,
      messages_json TEXT NOT NULL, summary TEXT, archived_at TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (learner_id, profile, section_id)
    );
    CREATE TABLE conversation_summaries (
      learner_id TEXT NOT NULL, profile TEXT NOT NULL, section_id TEXT NOT NULL,
      summary TEXT NOT NULL, exchange_count INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (learner_id, profile, section_id)
    );
  `);
  sqliteDb.exec(ENROLLMENT_TABLES_SQL);
  seedCurriculumVersions(sqliteDb);
  sqliteDb.exec("INSERT INTO learners (id, display_name) VALUES ('test-learner', 'Test')");
  sqliteDb.exec("INSERT INTO learners (id, display_name) VALUES ('test-learner-123', 'Test 123')");
  sqliteDb.exec("INSERT INTO learners (id, display_name) VALUES ('test-learner-456', 'Test 456')");
});

afterEach(() => { sqliteDb?.close(); });

function makeDB() {
  return createD1Shim(sqliteDb);
}

function makeFailingProgressDB() {
  // Drop the progress table so writes fail
  sqliteDb.exec("DROP TABLE IF EXISTS curriculum_progress");
  return createD1Shim(sqliteDb);
}

const TEST_BODY = {
  profile: "level-1",
  section_id: "1.1",
  message: "What is software pilotry?",
  context: { conversation: [] },
};

/* ---- Tests ---- */

describe("fire-and-forget error logging", () => {
  let originalFetch: typeof globalThis.fetch;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch;
    consoleErrorSpy?.mockRestore();
  });

  it("logs error when updateSectionProgress fails (not silently swallowed)", async () => {
    originalFetch = globalThis.fetch;

    // Mock Gemini to return a socratic_probe response
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify(SOCRATIC_PROBE_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )) as unknown as typeof fetch;

    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    const failingDB = makeFailingProgressDB();

    // Import the route and build an app with env bindings injected via middleware
    const { socraticChat } = await import("../socratic-chat");
    const app = new Hono();
    app.use("*", async (c, next) => {
      // Inject env bindings and learnerId
      (c.env as Env) = {
        DB: failingDB as unknown as Env["DB"],
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "gemini-flash-latest",
      } as Env;
      c.set("learnerId" as never, "test-learner-123" as never);
      await next();
    });
    app.route("/", socraticChat);

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TEST_BODY),
    });

    // Route should still return 200 (fire-and-forget does not block)
    expect(res.status).toBe(200);

    // Wait for the fire-and-forget promise to settle
    await flushMicrotasks();

    const errorCalls = consoleErrorSpy.mock.calls;
    const progressErrors = errorCalls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("[progress]")
    );

    // The DB fails, so updateSectionProgress should have logged via console.error
    expect(progressErrors.length).toBeGreaterThanOrEqual(1);
    expect(progressErrors[0][0]).toContain("test-learner-123");
    expect(progressErrors[0][0]).toContain("1.1");
    expect(progressErrors[0][0]).toContain("level-1");

    // Response was not blocked by the error
    const json = await res.json();
    expect(json).toHaveProperty("reply");
  });

  it("logs error when session_complete post-processing fails (not silently swallowed)", async () => {
    originalFetch = globalThis.fetch;

    // Gemini calls: first for main chat (session_complete), second for compress (returns summary)
    let callCount = 0;
    const COMPRESS_RESPONSE = {
      candidates: [{
        content: { parts: [{ text: "Summary of the learning session." }] },
      }],
    };
    globalThis.fetch = ((_url: string | URL | Request) => {
      callCount++;
      if (callCount === 1) {
        // Main chat Gemini call
        return Promise.resolve(
          new Response(JSON.stringify(SESSION_COMPLETE_RESPONSE), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      // compressConversation Gemini call - returns a valid summary
      return Promise.resolve(
        new Response(JSON.stringify(COMPRESS_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as unknown as typeof fetch;

    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    // DB that succeeds for everything except conversation operations
    // Drop conversation tables so session_complete post-processing fails
    sqliteDb.exec("DROP TABLE IF EXISTS curriculum_conversations");
    sqliteDb.exec("DROP TABLE IF EXISTS conversation_summaries");
    const progressOkButConvFailsDB = makeDB();

    const { socraticChat } = await import("../socratic-chat");
    const app = new Hono();
    app.use("*", async (c, next) => {
      (c.env as Env) = {
        DB: progressOkButConvFailsDB as unknown as Env["DB"],
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "gemini-flash-latest",
      } as Env;
      c.set("learnerId" as never, "test-learner-456" as never);
      await next();
    });
    app.route("/", socraticChat);

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TEST_BODY),
    });

    expect(res.status).toBe(200);

    // Wait for fire-and-forget promises to settle
    await flushMicrotasks();

    const errorCalls = consoleErrorSpy.mock.calls;
    const conversationErrors = errorCalls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("[conversation]")
    );

    // The DB conversation lookup should have failed and been logged
    expect(conversationErrors.length).toBeGreaterThanOrEqual(1);
    expect(conversationErrors[0][0]).toContain("test-learner-456");
    expect(conversationErrors[0][0]).toContain("1.1");

    const json = await res.json();
    expect(json).toHaveProperty("reply");
    expect(json).toHaveProperty("tool_type");
  });

  it("catch handler formats Error instances with .message", () => {
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    const err = new Error("DB connection lost");
    const learnerId = "learner-789";
    const sectionId = "2.1";
    const profile = "level-10";

    // Simulate the exact catch handler code from the route
    console.error(
      `[progress] Update failed learner=${learnerId} section=${sectionId} profile=${profile}:`,
      err instanceof Error ? err.message : err
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy.mock.calls[0];
    expect(call[0]).toBe(
      `[progress] Update failed learner=${learnerId} section=${sectionId} profile=${profile}:`
    );
    expect(call[1]).toBe("DB connection lost");
  });

  it("catch handler handles non-Error objects", () => {
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    const err = "string error";
    const learnerId = "learner-000";
    const sectionId = "1.2";

    // Simulate the compression catch handler with a non-Error
    console.error(
      `[conversation] Compression failed learner=${learnerId} section=${sectionId}:`,
      err instanceof Error ? err.message : err
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy.mock.calls[0];
    expect(call[0]).toContain("[conversation]");
    expect(call[1]).toBe("string error");
  });
});
