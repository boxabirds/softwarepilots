import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import type { SimulationScenario, SimulationSession, SimulationEvent, SimulationDebrief, TutorObservation } from "@softwarepilots/shared";
import type { GeminiFunctionCallResponse } from "../../lib/gemini";

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
    async batch<T>(): Promise<D1Result<T>[]> { throw new Error("not implemented"); },
    async dump(): Promise<ArrayBuffer> { throw new Error("not implemented"); },
    async exec(): Promise<D1ExecResult> { throw new Error("not implemented"); },
  } as unknown as D1Database;
}

/* ---- Test scenario ---- */

const TEST_SCENARIO: SimulationScenario = {
  id: "test-scenario-1",
  title: "Test Incident: Memory Leak",
  level: "level-1" as SimulationScenario["level"],
  tier: "introductory",
  prerequisite_scenarios: [],
  prerequisite_concepts: [],
  briefing: "A production service is showing memory growth. Investigate and resolve.",
  phases: [
    {
      id: "phase-1",
      narrative: "Memory usage is climbing. Dashboard shows 85% utilization.",
      available_actions: [
        {
          id: "check-metrics",
          category: "observe",
          label: "Check memory metrics",
          description: "View detailed memory usage over time",
          diagnostic_value: "high",
        },
        {
          id: "restart-service",
          category: "act",
          label: "Restart service",
          description: "Restart the affected service",
          diagnostic_value: "low",
          phase_trigger: "phase-2",
        },
      ],
      telemetry_snapshot: {
        metrics: [
          { name: "memory_usage_percent", value: 85, unit: "%", threshold: 90, status: "warning" },
        ],
        logs: [
          { timestamp: "2026-03-22T10:00:00Z", level: "warn", service: "api", message: "High memory usage detected" },
        ],
        dashboard_state: "degraded",
      },
      triggers: [
        { id: "trigger-1", condition: "restart-service", target_phase: "phase-2" },
      ],
    },
    {
      id: "phase-2",
      narrative: "Service restarted. Memory is temporarily low but climbing again.",
      available_actions: [
        {
          id: "check-heap-dump",
          category: "diagnose",
          label: "Analyze heap dump",
          description: "Look at memory allocation patterns",
          diagnostic_value: "high",
        },
      ],
      telemetry_snapshot: {
        metrics: [
          { name: "memory_usage_percent", value: 30, unit: "%", threshold: 90, status: "normal" },
        ],
        logs: [
          { timestamp: "2026-03-22T10:05:00Z", level: "info", service: "api", message: "Service restarted" },
        ],
        dashboard_state: "normal",
      },
      triggers: [],
    },
  ],
  root_causes: [{ id: "rc-1", description: "Event listener not cleaned up in WebSocket handler" }],
  intervention_thresholds: {
    stall_seconds: 120,
    wrong_direction_count: 3,
    fixation_loop_count: 2,
  },
};

const TEST_SCENARIO_WITH_AGENT: SimulationScenario = {
  ...TEST_SCENARIO,
  id: "test-scenario-agent",
  ai_agent_behavior: {
    behavior: "sometimes_wrong",
    personality: "Eager junior dev who sometimes jumps to conclusions",
    knowledge_gaps: ["memory profiling", "garbage collection"],
  },
};

/* ---- Test helpers ---- */

const LEARNER_ID = "test-learner-sim";

let sqliteDb: InstanceType<typeof Database>;
let d1: D1Database;

function buildApp() {
  const { simulation, registerScenario, clearScenarioRegistry } = require("../simulation");
  clearScenarioRegistry();
  registerScenario(TEST_SCENARIO);
  registerScenario(TEST_SCENARIO_WITH_AGENT);

  const app = new Hono();
  app.use("*", async (c, next) => {
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

beforeEach(() => {
  sqliteDb = new Database(":memory:");

  // Create required tables
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
    VALUES ('${LEARNER_ID}', 'sim@test.com', 'Sim Tester', 'github', '456')
  `);

  d1 = createD1Shim(sqliteDb);
});

afterEach(() => {
  sqliteDb.close();
});

/* ---- Unit tests ---- */

describe("simulation route helpers", () => {
  it("observeSilently returns correct stub observation", () => {
    const { observeSilently } = require("../simulation");
    const result = observeSilently();
    expect(result.tool).toBe("observe_silently");
    expect(result.visible).toBe(false);
  });

  it("generateStubDebrief returns valid debrief structure", () => {
    const { generateStubDebrief } = require("../simulation");
    const debrief = generateStubDebrief(TEST_SCENARIO, []);
    expect(debrief.good_judgment_moments).toEqual([]);
    expect(debrief.missed_signals).toEqual([]);
    expect(debrief.expert_path_comparison.expert_steps).toEqual([]);
    expect(debrief.accountability_assessment.overall).toContain("stub");
  });

  it("getScenario returns undefined for unknown scenario", () => {
    const { getScenario, clearScenarioRegistry } = require("../simulation");
    clearScenarioRegistry();
    expect(getScenario("nonexistent")).toBeUndefined();
  });

  it("registerScenario and getScenario work together", () => {
    const { registerScenario, getScenario, clearScenarioRegistry } = require("../simulation");
    clearScenarioRegistry();
    registerScenario(TEST_SCENARIO);
    const result = getScenario(TEST_SCENARIO.id);
    expect(result).toBeDefined();
    expect(result!.id).toBe(TEST_SCENARIO.id);
  });
});

/* ---- Integration tests: POST /start ---- */

describe("POST /start", () => {
  it("creates a new session and returns briefing", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      { DB: d1 } as Record<string, unknown>,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      session: SimulationSession;
      briefing: string;
      initial_phase: { id: string };
      available_actions: Array<{ id: string }>;
    };

    expect(body.session.scenario_id).toBe(TEST_SCENARIO.id);
    expect(body.session.status).toBe("active");
    expect(body.session.current_phase).toBe("phase-1");
    expect(body.briefing).toBe(TEST_SCENARIO.briefing);
    expect(body.initial_phase.id).toBe("phase-1");
    expect(body.available_actions.length).toBe(2);

    // Verify DB row
    const row = sqliteDb.prepare("SELECT * FROM simulation_sessions").get() as Record<string, unknown>;
    expect(row.learner_id).toBe(LEARNER_ID);
    expect(row.status).toBe("active");

    // Verify initial event
    const event = sqliteDb.prepare("SELECT * FROM simulation_events").get() as Record<string, unknown>;
    expect(event.event_type).toBe("observation");
  });

  it("returns 404 for unknown scenario_id", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: "nonexistent" }),
      { DB: d1 } as Record<string, unknown>,
    );

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("not found");
  });

  it("returns 409 when active session exists for same scenario", async () => {
    const app = buildApp();

    // Create first session
    const res1 = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res1.status).toBe(200);

    // Attempt second session
    const res2 = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res2.status).toBe(409);
    const body = await res2.json() as { error: string; session_id: string };
    expect(body.error).toContain("Active session");
    expect(body.session_id).toBeTruthy();
  });

  it("returns 400 when scenario_id is missing", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", {}),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(400);
  });
});

/* ---- Integration tests: POST /action ---- */

describe("POST /action", () => {
  async function createSession(): Promise<string> {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      { DB: d1 } as Record<string, unknown>,
    );
    const body = await res.json() as { session: SimulationSession };
    return body.session.id;
  }

  it("records action and returns result with telemetry", async () => {
    const sessionId = await createSession();
    const app = buildApp();

    const res = await app.request(
      "/action",
      jsonReq("/action", { session_id: sessionId, action_id: "check-metrics" }),
      { DB: d1 } as Record<string, unknown>,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      action_result: { action_id: string; diagnostic_value: string };
      telemetry: { dashboard_state: string };
      phase_transition?: { from: string; to: string };
      tutor_observation: { tool: string };
      available_actions: Array<{ id: string }>;
    };

    expect(body.action_result.action_id).toBe("check-metrics");
    expect(body.action_result.diagnostic_value).toBe("high");
    expect(body.telemetry.dashboard_state).toBe("degraded");
    expect(body.phase_transition).toBeUndefined();
    expect(body.tutor_observation.tool).toBe("observe_silently");
    expect(body.available_actions.length).toBe(2);

    // Verify event persisted (initial event + action event)
    const events = sqliteDb.prepare("SELECT * FROM simulation_events ORDER BY created_at").all() as Array<Record<string, unknown>>;
    expect(events.length).toBe(2);
    expect(events[1].event_type).toBe("action");
  });

  it("triggers phase transition when action has phase_trigger", async () => {
    const sessionId = await createSession();
    const app = buildApp();

    const res = await app.request(
      "/action",
      jsonReq("/action", { session_id: sessionId, action_id: "restart-service" }),
      { DB: d1 } as Record<string, unknown>,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      phase_transition?: { from: string; to: string };
      telemetry: { dashboard_state: string };
      available_actions: Array<{ id: string }>;
    };

    expect(body.phase_transition).toBeDefined();
    expect(body.phase_transition!.from).toBe("phase-1");
    expect(body.phase_transition!.to).toBe("phase-2");
    // Telemetry should be from new phase
    expect(body.telemetry.dashboard_state).toBe("normal");
    // Actions should be from new phase
    expect(body.available_actions.length).toBe(1);
    expect(body.available_actions[0].id).toBe("check-heap-dump");

    // Verify session updated
    const session = sqliteDb.prepare("SELECT current_phase FROM simulation_sessions WHERE id = ?").get(sessionId) as { current_phase: string };
    expect(session.current_phase).toBe("phase-2");

    // Verify transition event recorded (initial + action + transition = 3)
    const events = sqliteDb.prepare("SELECT * FROM simulation_events WHERE session_id = ?").all(sessionId) as Array<Record<string, unknown>>;
    expect(events.length).toBe(3);
  });

  it("returns 404 for unknown session", async () => {
    const app = buildApp();
    const res = await app.request(
      "/action",
      jsonReq("/action", { session_id: "nonexistent", action_id: "check-metrics" }),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 for completed session", async () => {
    const sessionId = await createSession();
    // Mark session completed
    sqliteDb.prepare("UPDATE simulation_sessions SET status = 'completed' WHERE id = ?").run(sessionId);

    const app = buildApp();
    const res = await app.request(
      "/action",
      jsonReq("/action", { session_id: sessionId, action_id: "check-metrics" }),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid action", async () => {
    const sessionId = await createSession();
    const app = buildApp();

    const res = await app.request(
      "/action",
      jsonReq("/action", { session_id: sessionId, action_id: "nonexistent-action" }),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Invalid action");
  });
});

/* ---- Integration tests: POST /ask-agent ---- */

describe("POST /ask-agent", () => {
  it("returns 400 when scenario has no AI agent", async () => {
    // Start a session with scenario that has no agent
    const app = buildApp();
    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      { DB: d1 } as Record<string, unknown>,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    const res = await app.request(
      "/ask-agent",
      jsonReq("/ask-agent", { session_id: session.id, message: "What should I do?" }),
      { DB: d1, GEMINI_API_KEY: "fake-key" } as Record<string, unknown>,
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("does not have an AI agent");
  });

  it("returns 404 for unknown session", async () => {
    const app = buildApp();
    const res = await app.request(
      "/ask-agent",
      jsonReq("/ask-agent", { session_id: "nonexistent", message: "hello" }),
      { DB: d1, GEMINI_API_KEY: "fake-key" } as Record<string, unknown>,
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when message is missing", async () => {
    const app = buildApp();
    const res = await app.request(
      "/ask-agent",
      jsonReq("/ask-agent", { session_id: "some-id" }),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("message is required");
  });
});

/* ---- Integration tests: POST /debrief ---- */

describe("POST /debrief", () => {
  async function createSession(): Promise<string> {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      { DB: d1 } as Record<string, unknown>,
    );
    const body = await res.json() as { session: SimulationSession };
    return body.session.id;
  }

  it("generates debrief and marks session completed", async () => {
    const sessionId = await createSession();
    const app = buildApp();

    const res = await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: sessionId }),
      { DB: d1 } as Record<string, unknown>,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      debrief: SimulationDebrief;
      session: SimulationSession;
    };

    expect(body.debrief).toBeDefined();
    // Gemini call fails in test (no API key), so fallback debrief is returned
    expect(body.debrief.accountability_assessment.overall).toContain("fallback");
    expect(body.session.status).toBe("completed");
    expect(body.session.completed_at).toBeTruthy();

    // Verify DB updated
    const row = sqliteDb.prepare("SELECT status, debrief_json FROM simulation_sessions WHERE id = ?").get(sessionId) as { status: string; debrief_json: string };
    expect(row.status).toBe("completed");
    expect(row.debrief_json).toBeTruthy();
  });

  it("returns existing debrief if already generated", async () => {
    const sessionId = await createSession();
    const app = buildApp();

    // Generate first debrief
    await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: sessionId }),
      { DB: d1 } as Record<string, unknown>,
    );

    // Request again - should return same debrief
    const res = await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: sessionId }),
      { DB: d1 } as Record<string, unknown>,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { debrief: SimulationDebrief };
    expect(body.debrief).toBeDefined();
  });

  it("returns 404 for unknown session", async () => {
    const app = buildApp();
    const res = await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: "nonexistent" }),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(404);
  });
});

/* ---- Integration tests: GET /session/:id ---- */

describe("GET /session/:id", () => {
  it("returns full session with events and current phase", async () => {
    const app = buildApp();

    // Create session
    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      { DB: d1 } as Record<string, unknown>,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    // Take an action
    await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id, action_id: "check-metrics" }),
      { DB: d1 } as Record<string, unknown>,
    );

    // Get session
    const res = await app.request(`/session/${session.id}`, { method: "GET" }, { DB: d1 } as Record<string, unknown>);

    expect(res.status).toBe(200);
    const body = await res.json() as {
      session: SimulationSession;
      events: SimulationEvent[];
      current_phase: { id: string };
      available_actions: Array<{ id: string }>;
    };

    expect(body.session.id).toBe(session.id);
    expect(body.events.length).toBe(2); // initial + action
    expect(body.current_phase.id).toBe("phase-1");
    expect(body.available_actions.length).toBe(2);
  });

  it("returns 404 for unknown session", async () => {
    const app = buildApp();
    const res = await app.request("/session/nonexistent", { method: "GET" }, { DB: d1 } as Record<string, unknown>);
    expect(res.status).toBe(404);
  });

  it("includes debrief when session is completed", async () => {
    const app = buildApp();

    // Create and debrief session
    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      { DB: d1 } as Record<string, unknown>,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: session.id }),
      { DB: d1 } as Record<string, unknown>,
    );

    const res = await app.request(`/session/${session.id}`, { method: "GET" }, { DB: d1 } as Record<string, unknown>);
    expect(res.status).toBe(200);
    const body = await res.json() as { debrief?: SimulationDebrief };
    expect(body.debrief).toBeDefined();
  });
});

/* ---- Integration: full session lifecycle ---- */

describe("full session lifecycle: start -> action -> action -> debrief", () => {
  it("completes a full lifecycle with correct status transitions and event counts", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    // 1. Start session
    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    expect(startRes.status).toBe(200);
    const startBody = await startRes.json() as { session: SimulationSession };
    const sessionId = startBody.session.id;
    expect(startBody.session.status).toBe("active");

    // Verify 1 event (observation: session_started)
    const eventsAfterStart = sqliteDb
      .prepare("SELECT * FROM simulation_events WHERE session_id = ?")
      .all(sessionId) as Array<Record<string, unknown>>;
    expect(eventsAfterStart.length).toBe(1);
    expect(eventsAfterStart[0].event_type).toBe("observation");

    // 2. First action (no phase change)
    const action1Res = await app.request(
      "/action",
      jsonReq("/action", { session_id: sessionId, action_id: "check-metrics" }),
      env,
    );
    expect(action1Res.status).toBe(200);
    const action1Body = await action1Res.json() as {
      action_result: { action_id: string };
      phase_transition?: unknown;
    };
    expect(action1Body.action_result.action_id).toBe("check-metrics");
    expect(action1Body.phase_transition).toBeUndefined();

    // Verify 2 events (observation + action)
    const eventsAfterAction1 = sqliteDb
      .prepare("SELECT * FROM simulation_events WHERE session_id = ?")
      .all(sessionId) as Array<Record<string, unknown>>;
    expect(eventsAfterAction1.length).toBe(2);

    // 3. Second action (triggers phase transition)
    const action2Res = await app.request(
      "/action",
      jsonReq("/action", { session_id: sessionId, action_id: "restart-service" }),
      env,
    );
    expect(action2Res.status).toBe(200);
    const action2Body = await action2Res.json() as {
      phase_transition?: { from: string; to: string };
    };
    expect(action2Body.phase_transition).toBeDefined();
    expect(action2Body.phase_transition!.from).toBe("phase-1");
    expect(action2Body.phase_transition!.to).toBe("phase-2");

    // Verify 4 events (observation + action + action + phase_transition observation)
    const eventsAfterAction2 = sqliteDb
      .prepare("SELECT * FROM simulation_events WHERE session_id = ?")
      .all(sessionId) as Array<Record<string, unknown>>;
    expect(eventsAfterAction2.length).toBe(4);

    // Session still active
    const sessionRow = sqliteDb
      .prepare("SELECT status FROM simulation_sessions WHERE id = ?")
      .get(sessionId) as { status: string };
    expect(sessionRow.status).toBe("active");

    // 4. Debrief
    const debriefRes = await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: sessionId }),
      env,
    );
    expect(debriefRes.status).toBe(200);
    const debriefBody = await debriefRes.json() as {
      debrief: SimulationDebrief;
      session: SimulationSession;
    };
    expect(debriefBody.session.status).toBe("completed");
    expect(debriefBody.session.completed_at).toBeTruthy();
    expect(debriefBody.debrief).toBeDefined();

    // Verify session completed in DB
    const finalSession = sqliteDb
      .prepare("SELECT status, completed_at, debrief_json FROM simulation_sessions WHERE id = ?")
      .get(sessionId) as { status: string; completed_at: string; debrief_json: string };
    expect(finalSession.status).toBe("completed");
    expect(finalSession.completed_at).toBeTruthy();
    expect(finalSession.debrief_json).toBeTruthy();
  });
});

/* ---- Integration: event recording detail ---- */

describe("event recording", () => {
  it("records correct event_type and event_data for each action", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    // Start session
    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    // Take action
    await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id, action_id: "check-metrics" }),
      env,
    );

    const events = sqliteDb
      .prepare("SELECT event_type, event_data FROM simulation_events WHERE session_id = ? ORDER BY created_at")
      .all(session.id) as Array<{ event_type: string; event_data: string }>;

    // First event: observation (session started)
    expect(events[0].event_type).toBe("observation");
    const startData = JSON.parse(events[0].event_data);
    expect(startData.type).toBe("session_started");
    expect(startData.phase).toBe("phase-1");

    // Second event: action
    expect(events[1].event_type).toBe("action");
    const actionData = JSON.parse(events[1].event_data);
    expect(actionData.action_id).toBe("check-metrics");
    expect(actionData.category).toBe("observe");
    expect(actionData.label).toBe("Check memory metrics");
  });

  it("records phase_transition observation event with from/to data", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    // Trigger phase transition
    await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id, action_id: "restart-service" }),
      env,
    );

    const events = sqliteDb
      .prepare("SELECT event_type, event_data FROM simulation_events WHERE session_id = ? ORDER BY created_at")
      .all(session.id) as Array<{ event_type: string; event_data: string }>;

    // Third event should be the phase transition observation
    const transitionEvent = events.find((e) => {
      if (e.event_type !== "observation") return false;
      const data = JSON.parse(e.event_data);
      return data.type === "phase_transition";
    });

    expect(transitionEvent).toBeDefined();
    const transData = JSON.parse(transitionEvent!.event_data);
    expect(transData.from).toBe("phase-1");
    expect(transData.to).toBe("phase-2");
  });
});

/* ---- Integration: tutor observation in action response ---- */

describe("tutor observation in action response", () => {
  it("action response includes tutor_observation field with observe_silently (stub)", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    const actionRes = await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id, action_id: "check-metrics" }),
      env,
    );

    const body = await actionRes.json() as {
      tutor_observation: TutorObservation;
    };

    expect(body.tutor_observation).toBeDefined();
    expect(body.tutor_observation.tool).toBe("observe_silently");
    expect(body.tutor_observation.visible).toBe(false);
  });
});

/* ---- Integration: session resume returns full state ---- */

describe("session resume via GET /session/:id", () => {
  it("returns all events after start + multiple actions", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    // Create session
    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    // Take two actions
    await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id, action_id: "check-metrics" }),
      env,
    );
    await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id, action_id: "restart-service" }),
      env,
    );

    // Resume: GET session
    const getRes = await app.request(
      `/session/${session.id}`,
      { method: "GET" },
      env,
    );

    expect(getRes.status).toBe(200);
    const body = await getRes.json() as {
      session: SimulationSession;
      events: SimulationEvent[];
      current_phase: { id: string };
      available_actions: Array<{ id: string }>;
      debrief?: SimulationDebrief;
    };

    // Events: observation(start) + action(check-metrics) + action(restart-service) + observation(phase_transition)
    expect(body.events.length).toBe(4);
    expect(body.events[0].event_type).toBe("observation");
    expect(body.events[1].event_type).toBe("action");
    expect(body.events[2].event_type).toBe("action");
    expect(body.events[3].event_type).toBe("observation");

    // Phase should be phase-2 after restart-service trigger
    expect(body.session.current_phase).toBe("phase-2");
    expect(body.current_phase.id).toBe("phase-2");
    expect(body.available_actions.length).toBe(1);
    expect(body.available_actions[0].id).toBe("check-heap-dump");

    // No debrief yet
    expect(body.debrief).toBeUndefined();
  });

  it("returns debrief when session has been debriefed", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    // Create session and debrief it
    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: session.id }),
      env,
    );

    // Resume
    const getRes = await app.request(
      `/session/${session.id}`,
      { method: "GET" },
      env,
    );

    const body = await getRes.json() as {
      session: SimulationSession;
      debrief?: SimulationDebrief;
    };

    expect(body.session.status).toBe("completed");
    expect(body.debrief).toBeDefined();
    expect(body.debrief!.accountability_assessment).toBeDefined();
  });
});

/* ---- Integration: debrief structure validation ---- */

describe("debrief structure", () => {
  it("debrief JSON has all required top-level fields", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    // Take an action before debrief
    await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id, action_id: "check-metrics" }),
      env,
    );

    const debriefRes = await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: session.id }),
      env,
    );

    const body = await debriefRes.json() as { debrief: SimulationDebrief };
    const d = body.debrief;

    // Required fields
    expect(Array.isArray(d.good_judgment_moments)).toBe(true);
    expect(Array.isArray(d.missed_signals)).toBe(true);
    expect(d.expert_path_comparison).toBeDefined();
    expect(Array.isArray(d.expert_path_comparison.expert_steps)).toBe(true);
    expect(Array.isArray(d.expert_path_comparison.trainee_steps)).toBe(true);
    expect(Array.isArray(d.expert_path_comparison.divergence_points)).toBe(true);
    expect(d.accountability_assessment).toBeDefined();
    expect(typeof d.accountability_assessment.verified).toBe("boolean");
    expect(typeof d.accountability_assessment.escalated_when_needed).toBe("boolean");
    expect(typeof d.accountability_assessment.documented_reasoning).toBe("boolean");
    expect(typeof d.accountability_assessment.overall).toBe("string");
  });

  it("debrief is stored in DB as valid JSON", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: session.id }),
      env,
    );

    const row = sqliteDb
      .prepare("SELECT debrief_json FROM simulation_sessions WHERE id = ?")
      .get(session.id) as { debrief_json: string };

    expect(row.debrief_json).toBeTruthy();
    const parsed = JSON.parse(row.debrief_json) as SimulationDebrief;
    expect(parsed.accountability_assessment).toBeDefined();
    expect(parsed.expert_path_comparison).toBeDefined();
  });
});

/* ---- Integration: error edge cases ---- */

describe("error edge cases", () => {
  it("action on completed session returns 409", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    // Create and complete session via debrief
    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: session.id }),
      env,
    );

    // Attempt action on completed session
    const actionRes = await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id, action_id: "check-metrics" }),
      env,
    );
    expect(actionRes.status).toBe(409);
    const body = await actionRes.json() as { error: string };
    expect(body.error).toContain("not active");
  });

  it("duplicate debrief returns existing debrief without error", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    // First debrief
    const debrief1Res = await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: session.id }),
      env,
    );
    expect(debrief1Res.status).toBe(200);
    const debrief1Body = await debrief1Res.json() as { debrief: SimulationDebrief };

    // Second debrief (duplicate)
    const debrief2Res = await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: session.id }),
      env,
    );
    expect(debrief2Res.status).toBe(200);
    const debrief2Body = await debrief2Res.json() as { debrief: SimulationDebrief };

    // Same debrief returned
    expect(debrief2Body.debrief.accountability_assessment.overall)
      .toBe(debrief1Body.debrief.accountability_assessment.overall);
  });

  it("start with invalid JSON returns 400", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      },
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(400);
  });

  it("action with missing session_id returns 400", async () => {
    const app = buildApp();
    const res = await app.request(
      "/action",
      jsonReq("/action", { action_id: "check-metrics" }),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("session_id");
  });

  it("action with missing action_id returns 400", async () => {
    const app = buildApp();
    const env = { DB: d1 } as Record<string, unknown>;

    const startRes = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: TEST_SCENARIO.id }),
      env,
    );
    const { session } = await startRes.json() as { session: SimulationSession };

    const res = await app.request(
      "/action",
      jsonReq("/action", { session_id: session.id }),
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("action_id");
  });

  it("debrief with missing session_id returns 400", async () => {
    const app = buildApp();
    const res = await app.request(
      "/debrief",
      jsonReq("/debrief", {}),
      { DB: d1 } as Record<string, unknown>,
    );
    expect(res.status).toBe(400);
  });
});

/* ---- Integration: evaluateAction (tutor framework) with mock Gemini ---- */

describe("evaluateAction integration with mock Gemini", () => {
  // These tests exercise the tutor framework's evaluateAction function
  // directly with mock fetch responses, verifying tool call parsing.

  const { evaluateAction } = require("../simulation-tutor");

  const mockEnvBase = {
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "test-model",
    DB: {} as unknown,
    EVALUATOR: {} as unknown,
    ENVIRONMENT: "test",
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    JWT_SECRET: "",
    WEB_APP_URL: "",
    ADMIN_API_KEY: "",
  };

  const testActionLog = [
    {
      action_id: "check-metrics",
      category: "observe" as const,
      label: "Check memory metrics",
      timestamp: "2026-03-22T10:01:00Z",
      diagnostic_value: "high" as const,
      phase_id: "phase-1",
    },
  ];

  function makeMockGeminiResponse(toolName: string, args: Record<string, string>): GeminiFunctionCallResponse {
    return {
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: toolName, args } }],
          },
        },
      ],
    };
  }

  it("parses observe_silently tool call correctly", async () => {
    const mockResponse = makeMockGeminiResponse("observe_silently", {
      reasoning: "Trainee is progressing well",
    });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const result = await evaluateAction(
        mockEnvBase,
        testActionLog,
        TEST_SCENARIO,
        TEST_SCENARIO.phases[0],
        TEST_SCENARIO.intervention_thresholds,
      );

      expect(result.tool).toBe("observe_silently");
      expect(result.visible).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses gentle_nudge tool call with visible content", async () => {
    const mockResponse = makeMockGeminiResponse("gentle_nudge", {
      observation: "Trainee is stalling",
      hint: "Have you considered checking the logs?",
      confidence: "medium",
    });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const result = await evaluateAction(
        mockEnvBase,
        testActionLog,
        TEST_SCENARIO,
        TEST_SCENARIO.phases[0],
        TEST_SCENARIO.intervention_thresholds,
      );

      expect(result.tool).toBe("gentle_nudge");
      expect(result.visible).toBe(true);
      expect(result.content).toBe("Have you considered checking the logs?");
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.hint).toBe("Have you considered checking the logs?");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses direct_intervention tool call", async () => {
    const mockResponse = makeMockGeminiResponse("direct_intervention", {
      observation: "Trainee is going in the wrong direction",
      guidance: "You should check the error logs first",
      severity: "moderate",
    });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const result = await evaluateAction(
        mockEnvBase,
        testActionLog,
        TEST_SCENARIO,
        TEST_SCENARIO.phases[0],
        TEST_SCENARIO.intervention_thresholds,
      );

      expect(result.tool).toBe("direct_intervention");
      expect(result.visible).toBe(true);
      expect(result.content).toBe("You should check the error logs first");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses highlight_good_judgment tool call", async () => {
    const mockResponse = makeMockGeminiResponse("highlight_good_judgment", {
      decision: "Checked metrics first",
      why_it_matters: "Good engineers always verify with data before acting",
    });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const result = await evaluateAction(
        mockEnvBase,
        testActionLog,
        TEST_SCENARIO,
        TEST_SCENARIO.phases[0],
        TEST_SCENARIO.intervention_thresholds,
      );

      expect(result.tool).toBe("highlight_good_judgment");
      expect(result.visible).toBe(true);
      expect(result.content).toContain("Checked metrics first");
      expect(result.content).toContain("Good engineers always verify");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses accountability_moment tool call", async () => {
    const mockResponse = makeMockGeminiResponse("accountability_moment", {
      decision_context: "About to restart the service",
      probe_question: "What evidence supports restarting rather than investigating further?",
      dimension: "diagnosis",
    });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const result = await evaluateAction(
        mockEnvBase,
        testActionLog,
        TEST_SCENARIO,
        TEST_SCENARIO.phases[0],
        TEST_SCENARIO.intervention_thresholds,
      );

      expect(result.tool).toBe("accountability_moment");
      expect(result.visible).toBe(true);
      expect(result.content).toBe("What evidence supports restarting rather than investigating further?");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns observe_silently on Gemini HTTP error (graceful degradation)", async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response("Internal Server Error", { status: 500 });

    try {
      const result = await evaluateAction(
        mockEnvBase,
        testActionLog,
        TEST_SCENARIO,
        TEST_SCENARIO.phases[0],
        TEST_SCENARIO.intervention_thresholds,
      );

      expect(result.tool).toBe("observe_silently");
      expect(result.visible).toBe(false);
      expect(result.metadata).toHaveProperty("error", true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns observe_silently on network failure (graceful degradation)", async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => {
      throw new Error("Network unreachable");
    };

    try {
      const result = await evaluateAction(
        mockEnvBase,
        testActionLog,
        TEST_SCENARIO,
        TEST_SCENARIO.phases[0],
        TEST_SCENARIO.intervention_thresholds,
      );

      expect(result.tool).toBe("observe_silently");
      expect(result.visible).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns observe_silently when Gemini returns no function call", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "I cannot determine the right tool to use." }],
          },
        },
      ],
    };

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const result = await evaluateAction(
        mockEnvBase,
        testActionLog,
        TEST_SCENARIO,
        TEST_SCENARIO.phases[0],
        TEST_SCENARIO.intervention_thresholds,
      );

      expect(result.tool).toBe("observe_silently");
      expect(result.visible).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
