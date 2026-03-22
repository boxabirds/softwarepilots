import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import type {
  SimulationScenario,
  SimulationSession,
  SimulationEvent,
  SimulationDebrief,
  TutorObservation,
} from "@softwarepilots/shared";
import { s1_1_falseGreenTestSuite } from "@softwarepilots/shared";

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
        async first<T>(): Promise<T | null> {
          const stmt = sqliteDb.prepare(query);
          const row = stmt.get(...bindings) as T | undefined;
          return row ?? null;
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
        async all<T>(): Promise<D1Result<T>> {
          const stmt = sqliteDb.prepare(query);
          const rows = stmt.all(...bindings) as T[];
          return {
            results: rows,
            success: true,
            meta: {
              duration: 0,
              changes: 0,
              last_row_id: 0,
              changed_db: false,
              size_after: 0,
              rows_read: rows.length,
              rows_written: 0,
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

const LEARNER_ID = "test-learner-s11";
const SCENARIO_ID = "S1.1";

/* ---- Test helpers ---- */

let sqliteDb: InstanceType<typeof Database>;
let d1: D1Database;

function buildApp() {
  const { simulation, registerScenario, clearScenarioRegistry } = require("../simulation");
  clearScenarioRegistry();
  registerScenario(s1_1_falseGreenTestSuite);

  const app = new Hono();
  app.use("*", async (c: { set: (k: never, v: string) => void }, next: () => Promise<void>) => {
    c.set("learnerId" as never, LEARNER_ID);
    await next();
  });
  app.route("/", simulation);
  return app;
}

function jsonReq(path: string, body: unknown, method = "POST") {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function makeEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { DB: d1, GEMINI_API_KEY: "fake-key", ...overrides };
}

function mockGeminiFetch(responseText: string) {
  return async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: responseText }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
}

async function startSession(): Promise<string> {
  const app = buildApp();
  const res = await app.request(
    "/start",
    jsonReq("/start", { scenario_id: SCENARIO_ID }),
    makeEnv(),
  );
  const body = (await res.json()) as { session: SimulationSession };
  return body.session.id;
}

async function doAction(sessionId: string, actionId: string) {
  const app = buildApp();
  const res = await app.request(
    "/action",
    jsonReq("/action", { session_id: sessionId, action_id: actionId }),
    makeEnv(),
  );
  return res;
}

async function askAgent(sessionId: string, message: string, fetchMock?: typeof globalThis.fetch) {
  const originalFetch = globalThis.fetch;
  if (fetchMock) {
    (globalThis as any).fetch = fetchMock;
  }
  try {
    const app = buildApp();
    const res = await app.request(
      "/ask-agent",
      jsonReq("/ask-agent", { session_id: sessionId, message }),
      makeEnv(),
    );
    return res;
  } finally {
    if (fetchMock) {
      globalThis.fetch = originalFetch;
    }
  }
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
    CREATE TABLE simulation_sessions (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL REFERENCES learners(id),
      scenario_id TEXT NOT NULL,
      profile TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      current_phase TEXT NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      debrief_json TEXT
    )
  `);

  sqliteDb.exec(`
    CREATE TABLE simulation_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES simulation_sessions(id),
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  sqliteDb.exec(`
    INSERT INTO learners (id, email, display_name, auth_provider, auth_subject)
    VALUES ('${LEARNER_ID}', 's11@test.com', 'S11 Tester', 'github', '789')
  `);

  d1 = createD1Shim(sqliteDb);
});

afterEach(() => {
  sqliteDb.close();
});

/* ---- S1.1 Scenario registration ---- */

describe("S1.1 scenario registration", () => {
  it("registers S1.1 scenario and returns it via getScenario", () => {
    const { getScenario, clearScenarioRegistry, registerScenario } = require("../simulation");
    clearScenarioRegistry();
    registerScenario(s1_1_falseGreenTestSuite);
    const scenario = getScenario(SCENARIO_ID);
    expect(scenario).toBeDefined();
    expect(scenario!.id).toBe(SCENARIO_ID);
    expect(scenario!.title).toBe("The False Green Test Suite");
    expect(scenario!.ai_agent_behavior).toBeDefined();
    expect(scenario!.ai_agent_behavior!.behavior).toBe("sometimes_wrong");
  });
});

/* ---- Gray failure telemetry ---- */

describe("S1.1 gray failure telemetry", () => {
  it("initial phase has deceptive_normal dashboard state", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: SCENARIO_ID }),
      makeEnv(),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      initial_phase: {
        id: string;
        telemetry_snapshot: {
          dashboard_state: string;
          metrics: Array<{ name: string; value: number; unit: string; status: string }>;
        };
      };
    };

    expect(body.initial_phase.id).toBe("subtle-anomaly");
    expect(body.initial_phase.telemetry_snapshot.dashboard_state).toBe("deceptive_normal");
  });

  it("p99 is elevated but p50 is normal in initial phase", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: SCENARIO_ID }),
      makeEnv(),
    );

    const body = (await res.json()) as {
      initial_phase: {
        telemetry_snapshot: {
          metrics: Array<{ name: string; value: number; status: string }>;
        };
      };
    };

    const metrics = body.initial_phase.telemetry_snapshot.metrics;
    const p99 = metrics.find((m) => m.name === "Response Time p99");
    const p50 = metrics.find((m) => m.name === "Response Time p50");

    expect(p99).toBeDefined();
    expect(p99!.value).toBe(900);
    expect(p99!.status).toBe("warning");

    expect(p50).toBeDefined();
    expect(p50!.value).toBe(80);
    expect(p50!.status).toBe("normal");
  });

  it("error rate is 0% in initial phase", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: SCENARIO_ID }),
      makeEnv(),
    );

    const body = (await res.json()) as {
      initial_phase: {
        telemetry_snapshot: {
          metrics: Array<{ name: string; value: number; unit: string }>;
        };
      };
    };

    const errorRate = body.initial_phase.telemetry_snapshot.metrics.find(
      (m) => m.name === "Error Rate",
    );
    expect(errorRate).toBeDefined();
    expect(errorRate!.value).toBe(0);
    expect(errorRate!.unit).toBe("%");
  });
});

/* ---- Verify-first path ---- */

describe("S1.1 verify-first path", () => {
  it("start -> view-latency -> ask agent -> view-traces -> pattern-identified via AND trigger", async () => {
    const sessionId = await startSession();

    // Step 1: view-latency (no phase change - only one of two required actions)
    const latencyRes = await doAction(sessionId, "view-latency");
    expect(latencyRes.status).toBe(200);
    const latencyBody = (await latencyRes.json()) as {
      phase_transition?: { from: string; to: string };
      action_result: { action_id: string; diagnostic_value: string };
    };
    expect(latencyBody.phase_transition).toBeUndefined();
    expect(latencyBody.action_result.action_id).toBe("view-latency");
    expect(latencyBody.action_result.diagnostic_value).toBe("high");

    // Step 2: ask AI agent (mock Gemini returning caching diagnosis)
    const agentRes = await askAgent(
      sessionId,
      "What do you think is causing the latency issue?",
      mockGeminiFetch("This looks like a cache invalidation problem. The p99/p50 divergence suggests some requests are hitting stale cache entries. I recommend clearing the cache.") as unknown as typeof globalThis.fetch,
    );
    expect(agentRes.status).toBe(200);
    const agentBody = (await agentRes.json()) as { response: string };
    expect(agentBody.response).toContain("cache");

    // Step 3: view-traces - AND trigger fires (view-traces AND view-latency both taken)
    const tracesRes = await doAction(sessionId, "view-traces");
    expect(tracesRes.status).toBe(200);
    const tracesBody = (await tracesRes.json()) as {
      phase_transition?: { from: string; to: string };
      telemetry: { dashboard_state: string };
      available_actions: Array<{ id: string }>;
    };

    // AND trigger: "action:view-traces AND action:view-latency" -> pattern-identified
    expect(tracesBody.phase_transition).toBeDefined();
    expect(tracesBody.phase_transition!.from).toBe("subtle-anomaly");
    expect(tracesBody.phase_transition!.to).toBe("pattern-identified");

    // Pattern-identified phase should have new diagnostic actions
    const actionIds = tracesBody.available_actions.map((a) => a.id);
    expect(actionIds).toContain("examine-shared-resource");
    expect(actionIds).toContain("add-concurrency-test");
    expect(actionIds).toContain("add-request-queuing");

    // Verify session DB updated
    const session1 = sqliteDb
      .prepare("SELECT current_phase FROM simulation_sessions WHERE id = ?")
      .get(sessionId) as { current_phase: string };
    expect(session1.current_phase).toBe("pattern-identified");
  });

  it("transitions through pattern-identified to resolved via add-request-queuing", async () => {
    const sessionId = await startSession();

    // View both latency and traces to trigger pattern-identified via AND trigger
    await doAction(sessionId, "view-latency");
    const tracesRes = await doAction(sessionId, "view-traces");
    const tracesBody = (await tracesRes.json()) as {
      phase_transition?: { from: string; to: string };
    };
    expect(tracesBody.phase_transition).toBeDefined();
    expect(tracesBody.phase_transition!.to).toBe("pattern-identified");

    // From pattern-identified, add-request-queuing has phase_trigger "correct-fix" -> resolved
    const fixRes = await doAction(sessionId, "add-request-queuing");
    expect(fixRes.status).toBe(200);
    const fixBody = (await fixRes.json()) as {
      phase_transition?: { from: string; to: string };
      telemetry: { dashboard_state: string };
    };
    expect(fixBody.phase_transition).toBeDefined();
    expect(fixBody.phase_transition!.from).toBe("pattern-identified");
    expect(fixBody.phase_transition!.to).toBe("resolved");
    expect(fixBody.telemetry.dashboard_state).toBe("normal");
  });
});

/* ---- Trust-AI path ---- */

describe("S1.1 trust-AI path", () => {
  it("start -> ask agent -> clear-caches transitions to cache-cleared-phase", async () => {
    const sessionId = await startSession();

    // Ask agent first (mock Gemini)
    const agentRes = await askAgent(
      sessionId,
      "Why is p99 high but p50 normal?",
      mockGeminiFetch("This is a cache invalidation problem. Clear the application caches to resolve it.") as unknown as typeof globalThis.fetch,
    );
    expect(agentRes.status).toBe(200);
    const agentBody = (await agentRes.json()) as { response: string };
    expect(agentBody.response).toContain("cache");

    // Verify agent_query event recorded
    const agentEvents = sqliteDb
      .prepare("SELECT * FROM simulation_events WHERE session_id = ? AND event_type = 'agent_query'")
      .all(sessionId) as Array<{ event_data: string }>;
    expect(agentEvents.length).toBe(1);
    const eventData = JSON.parse(agentEvents[0].event_data) as { message: string; response: string };
    expect(eventData.message).toContain("p99");
    expect(eventData.response).toContain("cache");

    // Act on AI advice without verification: clear-caches
    const clearRes = await doAction(sessionId, "clear-caches");
    expect(clearRes.status).toBe(200);
    const clearBody = (await clearRes.json()) as {
      phase_transition?: { from: string; to: string };
      telemetry: {
        dashboard_state: string;
        metrics: Array<{ name: string; value: number }>;
      };
      available_actions: Array<{ id: string }>;
    };

    // Phase transition: subtle-anomaly -> cache-cleared-phase
    expect(clearBody.phase_transition).toBeDefined();
    expect(clearBody.phase_transition!.from).toBe("subtle-anomaly");
    expect(clearBody.phase_transition!.to).toBe("cache-cleared-phase");

    // Verify session DB updated
    const session = sqliteDb
      .prepare("SELECT current_phase FROM simulation_sessions WHERE id = ?")
      .get(sessionId) as { current_phase: string };
    expect(session.current_phase).toBe("cache-cleared-phase");
  });

  it("cache-cleared-phase telemetry shows p99 briefly dropped then returned", async () => {
    const sessionId = await startSession();

    // Trigger cache-cleared-phase
    const clearRes = await doAction(sessionId, "clear-caches");
    const clearBody = (await clearRes.json()) as {
      telemetry: {
        metrics: Array<{ name: string; value: number; status: string }>;
      };
    };

    const metrics = clearBody.telemetry.metrics;

    // Original p99 still elevated
    const p99 = metrics.find((m) => m.name === "Response Time p99");
    expect(p99).toBeDefined();
    expect(p99!.value).toBe(900);
    expect(p99!.status).toBe("warning");

    // Post-clear p99 briefly dropped
    const p99PostClear = metrics.find((m) => m.name === "Response Time p99 (post-clear)");
    expect(p99PostClear).toBeDefined();
    expect(p99PostClear!.value).toBe(400);
    expect(p99PostClear!.status).toBe("normal");
  });

  it("cache-cleared-phase does not include clear-caches action (already tried)", async () => {
    const sessionId = await startSession();

    const clearRes = await doAction(sessionId, "clear-caches");
    const clearBody = (await clearRes.json()) as {
      available_actions: Array<{ id: string }>;
    };

    const actionIds = clearBody.available_actions.map((a) => a.id);
    expect(actionIds).not.toContain("clear-caches");
    // But observation actions should still be present
    expect(actionIds).toContain("view-latency");
    expect(actionIds).toContain("view-traces");
  });
});

/* ---- Ignore-AI path ---- */

describe("S1.1 ignore-AI path", () => {
  it("scenario works without querying AI agent at all", async () => {
    const sessionId = await startSession();

    // View latency - observe action, no phase change
    const latencyRes = await doAction(sessionId, "view-latency");
    expect(latencyRes.status).toBe(200);

    // Check errors - another observe action
    const errorsRes = await doAction(sessionId, "check-errors");
    expect(errorsRes.status).toBe(200);

    // View traces - observe action
    const tracesRes = await doAction(sessionId, "view-traces");
    expect(tracesRes.status).toBe(200);

    // Check tests - observe action
    const testsRes = await doAction(sessionId, "check-tests");
    expect(testsRes.status).toBe(200);

    // Verify no agent_query events exist
    const agentEvents = sqliteDb
      .prepare("SELECT * FROM simulation_events WHERE session_id = ? AND event_type = 'agent_query'")
      .all(sessionId) as Array<Record<string, unknown>>;
    expect(agentEvents.length).toBe(0);

    // All action events recorded
    const actionEvents = sqliteDb
      .prepare("SELECT * FROM simulation_events WHERE session_id = ? AND event_type = 'action'")
      .all(sessionId) as Array<Record<string, unknown>>;
    expect(actionEvents.length).toBe(4);
  });

  it("clear-caches triggers phase transition even without agent interaction", async () => {
    const sessionId = await startSession();

    // Go directly to clear-caches without asking agent
    const clearRes = await doAction(sessionId, "clear-caches");
    expect(clearRes.status).toBe(200);
    const clearBody = (await clearRes.json()) as {
      phase_transition?: { from: string; to: string };
    };

    expect(clearBody.phase_transition).toBeDefined();
    expect(clearBody.phase_transition!.from).toBe("subtle-anomaly");
    expect(clearBody.phase_transition!.to).toBe("cache-cleared-phase");
  });
});

/* ---- AI agent behavior ---- */

describe("S1.1 AI agent behavior", () => {
  it("POST /ask-agent returns response using agent_system_prompt", async () => {
    const sessionId = await startSession();

    const mockReply = "The p99/p50 divergence suggests stale cache entries. I recommend clearing the cache.";
    const res = await askAgent(
      sessionId,
      "What is causing the latency spike?",
      mockGeminiFetch(mockReply) as unknown as typeof globalThis.fetch,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { response: string };
    expect(body.response).toBe(mockReply);
  });

  it("records agent query as agent_query event type", async () => {
    const sessionId = await startSession();

    const mockReply = "This is a caching issue.";
    await askAgent(
      sessionId,
      "What do you think?",
      mockGeminiFetch(mockReply) as unknown as typeof globalThis.fetch,
    );

    const events = sqliteDb
      .prepare("SELECT event_type, event_data FROM simulation_events WHERE session_id = ? AND event_type = 'agent_query'")
      .all(sessionId) as Array<{ event_type: string; event_data: string }>;

    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe("agent_query");

    const eventData = JSON.parse(events[0].event_data) as { message: string; response: string };
    expect(eventData.message).toBe("What do you think?");
    expect(eventData.response).toBe(mockReply);
  });

  it("returns 502 when Gemini call fails", async () => {
    const sessionId = await startSession();

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => {
      throw new Error("Network error");
    };

    try {
      const app = buildApp();
      const res = await app.request(
        "/ask-agent",
        jsonReq("/ask-agent", { session_id: sessionId, message: "Hello" }),
        makeEnv(),
      );

      expect(res.status).toBe(502);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("unavailable");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sends agent_system_prompt from scenario to Gemini", async () => {
    const sessionId = await startSession();

    let capturedBody: string | null = null;
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Cache issue." }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const app = buildApp();
      await app.request(
        "/ask-agent",
        jsonReq("/ask-agent", { session_id: sessionId, message: "Diagnose this" }),
        makeEnv(),
      );

      expect(capturedBody).not.toBeNull();
      const parsed = JSON.parse(capturedBody!) as {
        systemInstruction: { parts: Array<{ text: string }> };
      };
      const systemText = parsed.systemInstruction.parts[0].text;

      // Should contain the S1.1 agent system prompt content
      expect(systemText).toContain("cache invalidation problem");
      expect(systemText).toContain("p99 latency spike");
      expect(systemText).toContain("Recommend clearing the cache");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

/* ---- Phase branching ---- */

describe("S1.1 phase branching", () => {
  it("clear-caches triggers cache-cleared-phase", async () => {
    const sessionId = await startSession();

    const res = await doAction(sessionId, "clear-caches");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      phase_transition?: { from: string; to: string };
    };

    expect(body.phase_transition).toBeDefined();
    expect(body.phase_transition!.from).toBe("subtle-anomaly");
    expect(body.phase_transition!.to).toBe("cache-cleared-phase");
  });

  it("pattern-identified phase has new diagnostic actions", () => {
    // Verify the scenario definition has the expected actions in pattern-identified phase
    const patternPhase = s1_1_falseGreenTestSuite.phases.find((p) => p.id === "pattern-identified");
    expect(patternPhase).toBeDefined();

    const actionIds = patternPhase!.available_actions.map((a) => a.id);
    expect(actionIds).toContain("examine-shared-resource");
    expect(actionIds).toContain("add-concurrency-test");
    expect(actionIds).toContain("add-request-queuing");
  });

  it("add-request-queuing in pattern-identified phase has correct-fix trigger", () => {
    const patternPhase = s1_1_falseGreenTestSuite.phases.find((p) => p.id === "pattern-identified");
    expect(patternPhase).toBeDefined();

    const addQueuing = patternPhase!.available_actions.find((a) => a.id === "add-request-queuing");
    expect(addQueuing).toBeDefined();
    expect(addQueuing!.phase_trigger).toBe("correct-fix");

    // Verify the trigger maps to resolved phase
    const trigger = patternPhase!.triggers.find((t) => t.id === "correct-fix");
    expect(trigger).toBeDefined();
    expect(trigger!.target_phase).toBe("resolved");
  });

  it("add-concurrency-test in pattern-identified phase has correct-fix trigger", () => {
    const patternPhase = s1_1_falseGreenTestSuite.phases.find((p) => p.id === "pattern-identified");
    expect(patternPhase).toBeDefined();

    const addTest = patternPhase!.available_actions.find((a) => a.id === "add-concurrency-test");
    expect(addTest).toBeDefined();
    expect(addTest!.phase_trigger).toBe("correct-fix");
  });
});

/* ---- Cache placebo ---- */

describe("S1.1 cache placebo", () => {
  it("cache-cleared-phase narrative mentions temporary improvement then regression", () => {
    const cachePhase = s1_1_falseGreenTestSuite.phases.find(
      (p) => p.id === "cache-cleared-phase",
    );
    expect(cachePhase).toBeDefined();
    expect(cachePhase!.narrative).toContain("drops to 400ms briefly");
    expect(cachePhase!.narrative).toContain("climbs back to 900ms");
    expect(cachePhase!.narrative).toContain("placebo");
  });

  it("cache-cleared-phase logs show latency trending upward post-clear", () => {
    const cachePhase = s1_1_falseGreenTestSuite.phases.find(
      (p) => p.id === "cache-cleared-phase",
    );
    expect(cachePhase).toBeDefined();

    const trendLog = cachePhase!.telemetry_snapshot.logs.find((l) =>
      l.message.includes("trending upward"),
    );
    expect(trendLog).toBeDefined();
    expect(trendLog!.message).toContain("400ms");
    expect(trendLog!.message).toContain("880ms");
  });

  it("cache-cleared-phase shows both original and post-clear p99 values", () => {
    const cachePhase = s1_1_falseGreenTestSuite.phases.find(
      (p) => p.id === "cache-cleared-phase",
    );
    expect(cachePhase).toBeDefined();

    const metrics = cachePhase!.telemetry_snapshot.metrics;
    const p99Original = metrics.find((m) => m.name === "Response Time p99");
    const p99PostClear = metrics.find((m) => m.name === "Response Time p99 (post-clear)");

    expect(p99Original).toBeDefined();
    expect(p99Original!.value).toBe(900);

    expect(p99PostClear).toBeDefined();
    expect(p99PostClear!.value).toBe(400);
  });
});

/* ---- Tutor context validation ---- */

describe("S1.1 tutor context", () => {
  it("coaching prompt mentions accountability_moment for unverified AI advice", () => {
    const scenario = s1_1_falseGreenTestSuite;
    expect(scenario.tutor_context).toBeDefined();
    expect(scenario.tutor_context!.coaching_prompt).toContain("accountability_moment");
  });

  it("coaching prompt mentions highlight_good_judgment for independent verification", () => {
    const scenario = s1_1_falseGreenTestSuite;
    expect(scenario.tutor_context!.coaching_prompt).toContain("highlight_good_judgment");
  });

  it("debrief prompt covers over-trust, under-trust, and calibrated assessment", () => {
    const scenario = s1_1_falseGreenTestSuite;
    const debrief = scenario.tutor_context!.debrief_prompt;
    expect(debrief).toContain("Over-trust");
    expect(debrief).toContain("Under-trust");
    expect(debrief).toContain("Calibrated");
  });

  it("agent system prompt describes confident caching diagnosis", () => {
    const scenario = s1_1_falseGreenTestSuite;
    const agentPrompt = scenario.ai_agent_behavior!.agent_system_prompt!;
    expect(agentPrompt).toContain("cache invalidation problem");
    expect(agentPrompt).toContain("Recommend clearing the cache");
    expect(agentPrompt).toContain("Do not volunteer that you might be wrong");
  });
});

/* ---- Resolved phase validation ---- */

describe("S1.1 resolved phase", () => {
  it("resolved phase has normal dashboard state and low latency", () => {
    const resolved = s1_1_falseGreenTestSuite.phases.find((p) => p.id === "resolved");
    expect(resolved).toBeDefined();
    expect(resolved!.telemetry_snapshot.dashboard_state).toBe("normal");

    const p99 = resolved!.telemetry_snapshot.metrics.find((m) => m.name === "Response Time p99");
    expect(p99).toBeDefined();
    expect(p99!.value).toBe(85);
    expect(p99!.status).toBe("normal");
  });

  it("resolved phase shows additional concurrency tests in suite", () => {
    const resolved = s1_1_falseGreenTestSuite.phases.find((p) => p.id === "resolved");
    expect(resolved).toBeDefined();

    const testSuite = resolved!.telemetry_snapshot.metrics.find((m) => m.name === "Test Suite");
    expect(testSuite).toBeDefined();
    expect(testSuite!.value).toBe(250); // 247 + 3 new concurrency tests
  });

  it("resolved phase has no available actions", () => {
    const resolved = s1_1_falseGreenTestSuite.phases.find((p) => p.id === "resolved");
    expect(resolved).toBeDefined();
    expect(resolved!.available_actions.length).toBe(0);
  });
});
