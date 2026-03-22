import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import type {
  SimulationScenario,
  SimulationSession,
  SimulationPhase,
  SimulationDebrief,
  MetricDataPoint,
} from "@softwarepilots/shared";
import { s101AgentAssistedDiagnosis } from "@softwarepilots/shared";
import { buildSimulationTutorPrompt } from "../simulation-tutor";
import type { ActionLogEntry } from "../simulation-tutor";

/* ---- Constants ---- */

const LEARNER_ID = "test-learner-s101";
const SCENARIO_ID = "S10.1";

/* Phase IDs from the scenario */
const PHASE_INITIAL = "multi-service-degradation";
const PHASE_DB_FIX_FAILED = "db-fix-failed";
const PHASE_ROOT_CAUSE_VISIBLE = "root-cause-visible-phase";
const PHASE_RESOLVED = "resolved";

/* Expected service count in initial telemetry */
const EXPECTED_SERVICE_COUNT = 3;

/* Expected metric values from scenario constants */
const PAYMENT_POOL_CRITICAL_PERCENT = 98;
const PAYMENT_RETRY_CRITICAL_PER_MIN = 5000;
const INVENTORY_TIMEOUT_CRITICAL_PERCENT = 40;
const FRONTEND_ERROR_CRITICAL_PERCENT = 25;
const DB_QUERY_LATENCY_MS = 45;

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

/* ---- Gemini mock helpers ---- */

function makeMockGeminiAgentResponse(text: string) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
  };
}

function makeMockGeminiTutorResponse(
  toolName: string,
  args: Record<string, string>,
) {
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

/* ---- Test setup ---- */

let sqliteDb: InstanceType<typeof Database>;
let d1: D1Database;

function buildApp() {
  const { simulation, registerScenario, clearScenarioRegistry } =
    require("../simulation");
  clearScenarioRegistry();
  registerScenario(s101AgentAssistedDiagnosis);

  const app = new Hono();
  app.use("*", async (c: { set: (k: never, v: string) => void }, next: () => Promise<void>) => {
    c.set("learnerId" as never, LEARNER_ID);
    await next();
  });
  app.route("/", simulation);
  return app;
}

function jsonReq(path: string, body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function env(overrides: Record<string, unknown> = {}) {
  return { DB: d1, GEMINI_API_KEY: "fake-key", ...overrides } as Record<
    string,
    unknown
  >;
}

async function startSession(): Promise<{
  sessionId: string;
  app: ReturnType<typeof buildApp>;
}> {
  const app = buildApp();
  const res = await app.request(
    "/start",
    jsonReq("/start", { scenario_id: SCENARIO_ID }),
    env(),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { session: SimulationSession };
  return { sessionId: body.session.id, app };
}

async function takeAction(
  app: ReturnType<typeof buildApp>,
  sessionId: string,
  actionId: string,
) {
  const res = await app.request(
    "/action",
    jsonReq("/action", { session_id: sessionId, action_id: actionId }),
    env(),
  );
  return {
    status: res.status,
    body: (await res.json()) as {
      action_result: {
        action_id: string;
        category: string;
        diagnostic_value: string;
      };
      telemetry: {
        metrics: MetricDataPoint[];
        dashboard_state: string;
      };
      phase_transition?: { from: string; to: string };
      tutor_observation: { tool: string };
      available_actions: Array<{ id: string }>;
    },
  };
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
    VALUES ('${LEARNER_ID}', 's101@test.com', 'S101 Tester', 'github', '789')
  `);

  d1 = createD1Shim(sqliteDb);
});

afterEach(() => {
  sqliteDb.close();
});

/* ---- 1. Independent reasoning path ---- */

describe("S10.1 independent reasoning path", () => {
  it("progresses through all phases: start -> observe -> root-cause-visible -> fix -> resolved", async () => {
    const { sessionId, app } = await startSession();

    // Phase 1: Observe payment metrics (no phase change)
    const r1 = await takeAction(app, sessionId, "check-payment");
    expect(r1.status).toBe(200);
    expect(r1.body.action_result.diagnostic_value).toBe("high");
    expect(r1.body.phase_transition).toBeUndefined();

    // Phase 1: Check connection pools (one of two required for root-cause-visible)
    const r2 = await takeAction(app, sessionId, "check-connection-pools");
    expect(r2.status).toBe(200);
    expect(r2.body.action_result.diagnostic_value).toBe("high");
    expect(r2.body.phase_transition).toBeUndefined();

    // Phase 1: View retry logs - AND trigger fires (check-connection-pools AND view-retry-logs)
    const r3 = await takeAction(app, sessionId, "view-retry-logs");
    expect(r3.status).toBe(200);
    expect(r3.body.action_result.diagnostic_value).toBe("high");
    expect(r3.body.phase_transition).toBeDefined();
    expect(r3.body.phase_transition!.from).toBe(PHASE_INITIAL);
    expect(r3.body.phase_transition!.to).toBe(PHASE_ROOT_CAUSE_VISIBLE);

    // Apply circuit breaker from root-cause-visible-phase -> resolved
    const r4 = await takeAction(app, sessionId, "apply-circuit-breaker");
    expect(r4.status).toBe(200);
    expect(r4.body.phase_transition).toBeDefined();
    expect(r4.body.phase_transition!.from).toBe(PHASE_ROOT_CAUSE_VISIBLE);
    expect(r4.body.phase_transition!.to).toBe(PHASE_RESOLVED);

    // Resolved phase should have normal metrics
    expect(r4.body.telemetry.dashboard_state).toBe("normal");
    expect(r4.body.available_actions.length).toBe(0);

    // Verify session updated in DB
    const session = sqliteDb
      .prepare("SELECT current_phase FROM simulation_sessions WHERE id = ?")
      .get(sessionId) as { current_phase: string };
    expect(session.current_phase).toBe(PHASE_RESOLVED);
  });

  it("tutor prompt includes highlight_good_judgment guidance for independent investigation", () => {
    const scenario = s101AgentAssistedDiagnosis;
    const phase = scenario.phases[0];

    const actionLog: ActionLogEntry[] = [
      {
        action_id: "check-connection-pools",
        category: "observe",
        label: "Check connection pool metrics across services",
        timestamp: "2026-01-15T14:30:00Z",
        diagnostic_value: "high",
        phase_id: PHASE_INITIAL,
      },
    ];

    const prompt = buildSimulationTutorPrompt(scenario, actionLog, phase);

    // Should include coaching prompt with highlight_good_judgment guidance
    expect(prompt).toContain("highlight_good_judgment");
    expect(prompt).toContain("Independent investigation");
    expect(prompt).toContain("independent reasoning");
  });
});

/* ---- 2. AI-following path ---- */

describe("S10.1 AI-following path", () => {
  it("db fix triggers db-fix-failed phase with unchanged metrics", async () => {
    const { sessionId, app } = await startSession();

    // Follow AI advice: optimize database
    const r1 = await takeAction(app, sessionId, "optimize-db");
    expect(r1.status).toBe(200);
    expect(r1.body.phase_transition).toBeDefined();
    expect(r1.body.phase_transition!.from).toBe(PHASE_INITIAL);
    expect(r1.body.phase_transition!.to).toBe(PHASE_DB_FIX_FAILED);

    // Metrics should be identical to phase 1 (no improvement)
    expect(r1.body.telemetry.dashboard_state).toBe("degraded");

    const poolMetric = r1.body.telemetry.metrics.find(
      (m: MetricDataPoint) => m.name === "Payment Connection Pool",
    );
    expect(poolMetric).toBeDefined();
    expect(poolMetric!.value).toBe(PAYMENT_POOL_CRITICAL_PERCENT);
    expect(poolMetric!.status).toBe("critical");
  });

  it("failover-replica also triggers db-fix-failed phase", async () => {
    const { sessionId, app } = await startSession();

    const r1 = await takeAction(app, sessionId, "failover-replica");
    expect(r1.status).toBe(200);
    expect(r1.body.phase_transition).toBeDefined();
    expect(r1.body.phase_transition!.to).toBe(PHASE_DB_FIX_FAILED);
    expect(r1.body.telemetry.dashboard_state).toBe("degraded");
  });

  it("from db-fix-failed, circuit breaker reaches resolved phase", async () => {
    const { sessionId, app } = await startSession();

    // First: go to db-fix-failed
    await takeAction(app, sessionId, "optimize-db");

    // Then apply correct fix
    const r2 = await takeAction(app, sessionId, "apply-circuit-breaker");
    expect(r2.status).toBe(200);
    expect(r2.body.phase_transition).toBeDefined();
    expect(r2.body.phase_transition!.from).toBe(PHASE_DB_FIX_FAILED);
    expect(r2.body.phase_transition!.to).toBe(PHASE_RESOLVED);
    expect(r2.body.telemetry.dashboard_state).toBe("normal");
  });

  it("tutor prompt includes accountability_moment guidance for AI-following", () => {
    const scenario = s101AgentAssistedDiagnosis;
    const phase = scenario.phases[0];

    const actionLog: ActionLogEntry[] = [
      {
        action_id: "optimize-db",
        category: "act",
        label: "Optimize database queries",
        timestamp: "2026-01-15T14:31:00Z",
        diagnostic_value: "misleading",
        phase_id: PHASE_INITIAL,
      },
    ];

    const prompt = buildSimulationTutorPrompt(scenario, actionLog, phase);

    // Should include coaching about accountability when following AI blindly
    expect(prompt).toContain("accountability_moment");
    expect(prompt).toContain("AI");
    expect(prompt).toContain("database");
  });
});

/* ---- 3. Fixation loop detection ---- */

describe("S10.1 fixation loop", () => {
  it("tutor prompt includes fixation context after repeated actions", () => {
    const scenario = s101AgentAssistedDiagnosis;
    const phase = scenario.phases[0];

    // Simulate asking AI the same question 3 times
    const actionLog: ActionLogEntry[] = [
      {
        action_id: "ask-agent-1",
        category: "delegate",
        label: "Ask AI about diagnosis",
        timestamp: "2026-01-15T14:30:00Z",
        diagnostic_value: "low",
        phase_id: PHASE_INITIAL,
      },
      {
        action_id: "ask-agent-2",
        category: "delegate",
        label: "Ask AI about diagnosis",
        timestamp: "2026-01-15T14:31:00Z",
        diagnostic_value: "low",
        phase_id: PHASE_INITIAL,
      },
      {
        action_id: "ask-agent-3",
        category: "delegate",
        label: "Ask AI about diagnosis",
        timestamp: "2026-01-15T14:32:00Z",
        diagnostic_value: "low",
        phase_id: PHASE_INITIAL,
      },
    ];

    const prompt = buildSimulationTutorPrompt(scenario, actionLog, phase);

    // The prompt should include fixation loop threshold info
    expect(prompt).toContain("Fixation loop threshold");
    expect(prompt).toContain("3");
    // Should list the repeated actions in the action log section
    expect(prompt).toContain("Ask AI about diagnosis");
    // The coaching prompt should mention fixation handling
    expect(prompt).toContain("fixation loop");
    expect(prompt).toContain("gentle_nudge");
  });

  it("intervention threshold for fixation is 3 in S10.1", () => {
    const scenario = s101AgentAssistedDiagnosis;
    expect(scenario.intervention_thresholds.fixation_loop_count).toBe(3);
  });
});

/* ---- 4. Agent behavior - confidently wrong ---- */

describe("S10.1 agent behavior", () => {
  it("POST /ask-agent uses scenario's agent_system_prompt", async () => {
    const { sessionId, app } = await startSession();

    const originalFetch = globalThis.fetch;
    let capturedBody: string | undefined;

    (globalThis as any).fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(
        JSON.stringify(
          makeMockGeminiAgentResponse(
            "This is a classic database bottleneck pattern.",
          ),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const res = await app.request(
        "/ask-agent",
        jsonReq("/ask-agent", {
          session_id: sessionId,
          message: "What do you think is wrong?",
        }),
        env(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { response: string };
      expect(body.response).toContain("database bottleneck");

      // Verify the system prompt sent to Gemini includes the scenario's agent prompt
      expect(capturedBody).toBeDefined();
      const parsed = JSON.parse(capturedBody!);
      const systemText = parsed.systemInstruction?.parts?.[0]?.text;
      expect(systemText).toContain("senior AI diagnostic engineer");
      expect(systemText).toContain("database performance issue");
      expect(systemText).toContain("CONFIDENT and AUTHORITATIVE");

      // Verify event recorded in DB
      const events = sqliteDb
        .prepare(
          "SELECT * FROM simulation_events WHERE session_id = ? AND event_type = 'agent_query'",
        )
        .all(sessionId) as Array<Record<string, unknown>>;
      expect(events.length).toBe(1);
      const eventData = JSON.parse(events[0].event_data as string);
      expect(eventData.message).toBe("What do you think is wrong?");
      expect(eventData.response).toContain("database bottleneck");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("scenario has confidently_wrong behavior configured", () => {
    const scenario = s101AgentAssistedDiagnosis;
    expect(scenario.ai_agent_behavior).toBeDefined();
    expect(scenario.ai_agent_behavior!.behavior).toBe("confidently_wrong");
    expect(scenario.ai_agent_behavior!.personality).toContain("Authoritative");
    expect(scenario.ai_agent_behavior!.knowledge_gaps).toContain(
      "retry storms",
    );
    expect(scenario.ai_agent_behavior!.knowledge_gaps).toContain(
      "connection pool exhaustion",
    );
  });

  it("agent_system_prompt contains behavior escalation instructions", () => {
    const scenario = s101AgentAssistedDiagnosis;
    const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;

    // Initial question: confident diagnosis
    expect(prompt).toContain("classic database bottleneck pattern");
    // Follow-up: doubles down
    expect(prompt).toContain("missing index");
    // Challenged with strong evidence: reluctant hedge
    expect(prompt).toContain("worth looking into");
    // Never fully admits being wrong
    expect(prompt).toContain("Never fully admit you are wrong");
  });
});

/* ---- 5. Multi-service telemetry ---- */

describe("S10.1 multi-service telemetry", () => {
  it("initial phase has metrics from 3 services", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: SCENARIO_ID }),
      env(),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      initial_phase: SimulationPhase;
    };

    const metrics = body.initial_phase.telemetry_snapshot.metrics;

    // Collect unique service prefixes
    const serviceNames = new Set(
      metrics.map((m: MetricDataPoint) => m.name.split(" ")[0]),
    );
    expect(serviceNames.size).toBe(EXPECTED_SERVICE_COUNT);
    expect(serviceNames.has("Payment")).toBe(true);
    expect(serviceNames.has("Inventory")).toBe(true);
    expect(serviceNames.has("Frontend")).toBe(true);
  });

  it("payment service has expected critical metrics", async () => {
    const { sessionId, app } = await startSession();

    const r = await takeAction(app, sessionId, "check-payment");
    const metrics = r.body.telemetry.metrics;

    const poolMetric = metrics.find(
      (m: MetricDataPoint) => m.name === "Payment Connection Pool",
    );
    expect(poolMetric).toBeDefined();
    expect(poolMetric!.value).toBe(PAYMENT_POOL_CRITICAL_PERCENT);
    expect(poolMetric!.status).toBe("critical");

    const retryMetric = metrics.find(
      (m: MetricDataPoint) => m.name === "Payment Retry Rate",
    );
    expect(retryMetric).toBeDefined();
    expect(retryMetric!.value).toBe(PAYMENT_RETRY_CRITICAL_PER_MIN);
  });

  it("inventory service shows 40% timeout rate", () => {
    const phase = s101AgentAssistedDiagnosis.phases[0];
    const timeoutMetric = phase.telemetry_snapshot.metrics.find(
      (m) => m.name === "Inventory Timeout Rate",
    );
    expect(timeoutMetric).toBeDefined();
    expect(timeoutMetric!.value).toBe(INVENTORY_TIMEOUT_CRITICAL_PERCENT);
    expect(timeoutMetric!.status).toBe("critical");
  });

  it("frontend shows 25% error rate", () => {
    const phase = s101AgentAssistedDiagnosis.phases[0];
    const errorMetric = phase.telemetry_snapshot.metrics.find(
      (m) => m.name === "Frontend Error Rate",
    );
    expect(errorMetric).toBeDefined();
    expect(errorMetric!.value).toBe(FRONTEND_ERROR_CRITICAL_PERCENT);
    expect(errorMetric!.status).toBe("critical");
  });

  it("DB query log shows 45ms (evidence DB is fine)", () => {
    const phase = s101AgentAssistedDiagnosis.phases[0];
    const dbLog = phase.telemetry_snapshot.logs.find((l) =>
      l.message.includes("Database query completed"),
    );
    expect(dbLog).toBeDefined();
    expect(dbLog!.message).toContain(`${DB_QUERY_LATENCY_MS}ms`);
  });
});

/* ---- 6. Cascading fix verification ---- */

describe("S10.1 cascading fix verification", () => {
  it("circuit breaker resolves all 3 services to normal", async () => {
    const { sessionId, app } = await startSession();

    const r = await takeAction(app, sessionId, "apply-circuit-breaker");
    expect(r.body.phase_transition).toBeDefined();
    expect(r.body.phase_transition!.to).toBe(PHASE_RESOLVED);

    // All metrics should now be normal
    const metrics = r.body.telemetry.metrics;
    const allNormal = metrics.every(
      (m: MetricDataPoint) => m.status === "normal",
    );
    expect(allNormal).toBe(true);

    // Verify all 3 services present in recovery metrics
    const serviceNames = new Set(
      metrics.map((m: MetricDataPoint) => m.name.split(" ")[0]),
    );
    expect(serviceNames.has("Payment")).toBe(true);
    expect(serviceNames.has("Inventory")).toBe(true);
    expect(serviceNames.has("Frontend")).toBe(true);
  });

  it("limit-connection-pool also resolves to normal", async () => {
    const { sessionId, app } = await startSession();

    const r = await takeAction(app, sessionId, "limit-connection-pool");
    expect(r.body.phase_transition).toBeDefined();
    expect(r.body.phase_transition!.to).toBe(PHASE_RESOLVED);
    expect(r.body.telemetry.dashboard_state).toBe("normal");
  });
});

/* ---- 7. Phase progression ---- */

describe("S10.1 phase progression", () => {
  it("optimize-db triggers db-fix-failed", async () => {
    const { sessionId, app } = await startSession();

    const r = await takeAction(app, sessionId, "optimize-db");
    expect(r.body.phase_transition!.to).toBe(PHASE_DB_FIX_FAILED);
  });

  it("failover-replica triggers db-fix-failed", async () => {
    const { sessionId, app } = await startSession();

    const r = await takeAction(app, sessionId, "failover-replica");
    expect(r.body.phase_transition!.to).toBe(PHASE_DB_FIX_FAILED);
  });

  it("apply-circuit-breaker triggers resolved", async () => {
    const { sessionId, app } = await startSession();

    const r = await takeAction(app, sessionId, "apply-circuit-breaker");
    expect(r.body.phase_transition!.to).toBe(PHASE_RESOLVED);
  });

  it("limit-connection-pool triggers resolved", async () => {
    const { sessionId, app } = await startSession();

    const r = await takeAction(app, sessionId, "limit-connection-pool");
    expect(r.body.phase_transition!.to).toBe(PHASE_RESOLVED);
  });

  it("db-fix-failed metrics identical to phase 1 (fix had no effect)", () => {
    const scenario = s101AgentAssistedDiagnosis;
    const phase1 = scenario.phases[0]; // multi-service-degradation
    const phase2 = scenario.phases[1]; // db-fix-failed

    // Both phases should have the same critical metrics
    const phase1MetricValues = phase1.telemetry_snapshot.metrics.map(
      (m) => `${m.name}:${m.value}`,
    );
    const phase2MetricValues = phase2.telemetry_snapshot.metrics.map(
      (m) => `${m.name}:${m.value}`,
    );
    expect(phase2MetricValues).toEqual(phase1MetricValues);

    // Both should be degraded
    expect(phase1.telemetry_snapshot.dashboard_state).toBe("degraded");
    expect(phase2.telemetry_snapshot.dashboard_state).toBe("degraded");
  });

  it("db-fix-failed removes optimize-db and failover-replica from available actions", () => {
    const scenario = s101AgentAssistedDiagnosis;
    const phase2 = scenario.phases[1]; // db-fix-failed

    const actionIds = phase2.available_actions.map((a) => a.id);
    expect(actionIds).not.toContain("optimize-db");
    expect(actionIds).not.toContain("failover-replica");
    // But correct fixes should still be available
    expect(actionIds).toContain("apply-circuit-breaker");
    expect(actionIds).toContain("limit-connection-pool");
  });
});

/* ---- 8. Single-service tunnel vision ---- */

describe("S10.1 single-service tunnel vision", () => {
  it("tutor prompt nudges about broader pattern when only payment checked", () => {
    const scenario = s101AgentAssistedDiagnosis;
    const phase = scenario.phases[0];

    // Only check payment - no other services
    const actionLog: ActionLogEntry[] = [
      {
        action_id: "check-payment",
        category: "observe",
        label: "Check payment service metrics",
        timestamp: "2026-01-15T14:30:00Z",
        diagnostic_value: "high",
        phase_id: PHASE_INITIAL,
      },
    ];

    const prompt = buildSimulationTutorPrompt(scenario, actionLog, phase);

    // The coaching prompt should contain guidance about tunnel vision
    expect(prompt).toContain("three services");
    expect(prompt).toContain("gentle_nudge");
    // The prompt should include the action log showing only payment was checked
    expect(prompt).toContain("Check payment service metrics");
  });

  it("scenario coaching prompt mentions broader pattern nudge", () => {
    const scenario = s101AgentAssistedDiagnosis;
    expect(scenario.tutor_context!.coaching_prompt).toContain(
      "three services are failing",
    );
    expect(scenario.tutor_context!.coaching_prompt).toContain(
      "pattern across all three",
    );
  });
});

/* ---- Session start details ---- */

describe("S10.1 session start", () => {
  it("returns correct briefing and initial phase for S10.1", async () => {
    const app = buildApp();
    const res = await app.request(
      "/start",
      jsonReq("/start", { scenario_id: SCENARIO_ID }),
      env(),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      session: SimulationSession;
      briefing: string;
      initial_phase: SimulationPhase;
      available_actions: Array<{ id: string }>;
    };

    expect(body.session.scenario_id).toBe(SCENARIO_ID);
    expect(body.session.current_phase).toBe(PHASE_INITIAL);
    expect(body.session.profile).toBe("level-10");
    expect(body.briefing).toContain("Multiple services");
    expect(body.initial_phase.id).toBe(PHASE_INITIAL);

    // Should have all phase 1 actions available
    const actionIds = body.available_actions.map((a) => a.id);
    expect(actionIds).toContain("check-payment");
    expect(actionIds).toContain("check-inventory");
    expect(actionIds).toContain("check-frontend");
    expect(actionIds).toContain("check-connection-pools");
    expect(actionIds).toContain("view-retry-logs");
    expect(actionIds).toContain("optimize-db");
    expect(actionIds).toContain("apply-circuit-breaker");
  });
});

/* ---- Debrief ---- */

describe("S10.1 debrief", () => {
  it("generates debrief after completing session (fallback without Gemini)", async () => {
    const { sessionId, app } = await startSession();

    // Take some actions
    await takeAction(app, sessionId, "check-payment");
    await takeAction(app, sessionId, "apply-circuit-breaker");

    // Request debrief (Gemini unavailable - falls back to minimal debrief)
    const res = await app.request(
      "/debrief",
      jsonReq("/debrief", { session_id: sessionId }),
      env(),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      debrief: SimulationDebrief;
      session: SimulationSession;
    };

    expect(body.debrief).toBeDefined();
    expect(body.session.status).toBe("completed");
    expect(body.debrief.accountability_assessment).toBeDefined();
  });
});
