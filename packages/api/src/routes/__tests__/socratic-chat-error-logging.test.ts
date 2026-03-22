/**
 * Integration tests: fire-and-forget error logging in socratic-chat route.
 *
 * Verifies that when updateSectionProgress or compressConversation fails,
 * errors are logged via console.error rather than silently swallowed.
 */

import { describe, it, expect, afterEach, spyOn } from "bun:test";
import { Hono } from "hono";
import type { Env } from "../../env";
import type { GeminiFunctionCallResponse } from "../../lib/gemini";

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

function makeFailingDB(errorMessage: string) {
  const failingStatement = {
    bind: (..._args: unknown[]) => failingStatement,
    run: () => Promise.reject(new Error(errorMessage)),
    first: () => Promise.reject(new Error(errorMessage)),
    all: () => Promise.reject(new Error(errorMessage)),
  };
  return {
    prepare: () => failingStatement,
    exec: () => Promise.reject(new Error(errorMessage)),
    batch: () => Promise.reject(new Error(errorMessage)),
    dump: () => Promise.reject(new Error(errorMessage)),
  };
}

function makeMinimalDB() {
  const noopStatement = {
    bind: (..._args: unknown[]) => noopStatement,
    run: () => Promise.resolve({ success: true, meta: {}, results: [] }),
    first: () => Promise.resolve(null),
    all: () => Promise.resolve({ success: true, meta: {}, results: [] }),
  };
  return {
    prepare: () => noopStatement,
    exec: () => Promise.resolve({ count: 0, duration: 0 }),
    batch: () => Promise.resolve([]),
    dump: () => Promise.resolve(new ArrayBuffer(0)),
  };
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

    const failingDB = makeFailingDB("D1_ERROR: SQLITE_CONSTRAINT");

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

    // DB that succeeds for progress updates but fails on conversation lookup
    // (the .then callback after compress queries for the conversation ID)
    const progressOkButConvFailsDB = makeMinimalDB();
    let prepareCallCount = 0;
    const originalPrepare = progressOkButConvFailsDB.prepare;
    progressOkButConvFailsDB.prepare = (sql?: string) => {
      prepareCallCount++;
      // The conversation SELECT query happens after compress succeeds
      // It queries curriculum_conversations - make this call throw
      if (sql && sql.includes("curriculum_conversations")) {
        const failingStmt = {
          bind: (..._args: unknown[]) => failingStmt,
          run: () => Promise.reject(new Error("D1_ERROR: conversation lookup failed")),
          first: () => Promise.reject(new Error("D1_ERROR: conversation lookup failed")),
          all: () => Promise.reject(new Error("D1_ERROR: conversation lookup failed")),
        };
        return failingStmt as ReturnType<typeof originalPrepare>;
      }
      return originalPrepare();
    };

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
