import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import type {
  SimulationSession,
  SimulationDebrief,
  SimulationPhase,
  TutorObservation,
} from "@softwarepilots/shared";
import { s04FirstSoloDiagnosis } from "@softwarepilots/shared";

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

/* ---- Response types ---- */

interface StartResponse {
  session: SimulationSession;
  briefing: string;
  initial_phase: SimulationPhase;
  available_actions: Array<{ id: string; category: string }>;
}

interface ActionResponse {
  action_result: {
    action_id: string;
    category: string;
    label: string;
    diagnostic_value: string;
  };
  telemetry: {
    metrics: Array<{ name: string; value: number; status: string }>;
    logs: Array<{ message: string }>;
    dashboard_state: string;
  };
  phase_transition?: { from: string; to: string };
  tutor_observation: TutorObservation;
  available_actions: Array<{ id: string; category: string }>;
}

interface DebriefResponse {
  debrief: SimulationDebrief;
  session: SimulationSession;
}

/* ---- Test helpers ---- */

const LEARNER_ID = "test-learner-s04";
const SCENARIO_ID = "S0.4";

let sqliteDb: InstanceType<typeof Database>;
let d1: D1Database;

function buildApp() {
  const { simulation, registerScenario, clearScenarioRegistry } =
    require("../simulation");
  clearScenarioRegistry();
  registerScenario(s04FirstSoloDiagnosis);

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

function env() {
  return { DB: d1 } as Record<string, unknown>;
}

async function startSession(app: ReturnType<typeof buildApp>): Promise<StartResponse> {
  const res = await app.request(
    "/start",
    jsonReq("/start", { scenario_id: SCENARIO_ID }),
    env(),
  );
  expect(res.status).toBe(200);
  return res.json() as Promise<StartResponse>;
}

async function takeAction(
  app: ReturnType<typeof buildApp>,
  sessionId: string,
  actionId: string,
): Promise<ActionResponse> {
  const res = await app.request(
    "/action",
    jsonReq("/action", { session_id: sessionId, action_id: actionId }),
    env(),
  );
  expect(res.status).toBe(200);
  return res.json() as Promise<ActionResponse>;
}

async function requestDebrief(
  app: ReturnType<typeof buildApp>,
  sessionId: string,
): Promise<DebriefResponse> {
  const res = await app.request(
    "/debrief",
    jsonReq("/debrief", { session_id: sessionId }),
    env(),
  );
  expect(res.status).toBe(200);
  return res.json() as Promise<DebriefResponse>;
}

/* ---- Mock Gemini for debrief calls ---- */

function mockGeminiDebrief(content: Partial<SimulationDebrief>) {
  const full: SimulationDebrief = {
    good_judgment_moments: content.good_judgment_moments ?? [],
    missed_signals: content.missed_signals ?? [],
    expert_path_comparison: content.expert_path_comparison ?? {
      expert_steps: ["Check metrics", "Check logs", "Check deployments", "Roll back deployment"],
      trainee_steps: [],
      divergence_points: [],
    },
    accountability_assessment: content.accountability_assessment ?? {
      verified: true,
      escalated_when_needed: false,
      documented_reasoning: true,
      overall: "Good diagnostic approach",
    },
  };

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("generativelanguage.googleapis.com")) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(full) }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return originalFetch(input);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

/* ---- Mock Gemini for tutor observation calls ---- */

function mockGeminiTutor(toolName: string, args: Record<string, string>) {
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("generativelanguage.googleapis.com")) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: toolName,
                      args,
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return originalFetch(input);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

/* ---- Setup / teardown ---- */

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
    VALUES ('${LEARNER_ID}', 's04@test.com', 'S04 Tester', 'github', '789')
  `);

  d1 = createD1Shim(sqliteDb);
});

afterEach(() => {
  sqliteDb.close();
});

/* ====================================================================
   1. Golden path: start -> check-logs -> check-deployments -> rollback -> debrief
   ==================================================================== */

describe("S0.4 golden path", () => {
  it("start returns alert-received phase with observation and remediation actions", async () => {
    const app = buildApp();
    const start = await startSession(app);

    expect(start.session.scenario_id).toBe(SCENARIO_ID);
    expect(start.session.current_phase).toBe("alert-received");
    expect(start.briefing).toContain("on call");
    expect(start.initial_phase.id).toBe("alert-received");

    // Should have observation actions plus restart and escalate
    const actionIds = start.available_actions.map((a) => a.id);
    expect(actionIds).toContain("check-logs");
    expect(actionIds).toContain("check-deployments");
    expect(actionIds).toContain("restart-service");
    expect(actionIds).toContain("escalate");
  });

  it("first observation stays in alert-received phase", async () => {
    const app = buildApp();
    const start = await startSession(app);

    const result = await takeAction(app, start.session.id, "check-logs");

    expect(result.phase_transition).toBeUndefined();
    expect(result.telemetry.dashboard_state).toBe("alarm");
    // Still in phase 1 - same actions available
    const actionIds = result.available_actions.map((a) => a.id);
    expect(actionIds).toContain("check-deployments");
    expect(actionIds).toContain("restart-service");
  });

  it("second observation advances to root-cause-identified phase", async () => {
    const app = buildApp();
    const start = await startSession(app);

    // First observation - no transition
    await takeAction(app, start.session.id, "check-logs");

    // Second observation - should trigger phase advance
    const result = await takeAction(app, start.session.id, "check-deployments");

    expect(result.phase_transition).toBeDefined();
    expect(result.phase_transition!.from).toBe("alert-received");
    expect(result.phase_transition!.to).toBe("root-cause-identified");

    // Phase 2 narrative mentions deployment correlation
    expect(result.telemetry.dashboard_state).toBe("alarm");

    // Phase 2 should have rollback and increase-memory actions
    const actionIds = result.available_actions.map((a) => a.id);
    expect(actionIds).toContain("rollback-deployment");
    expect(actionIds).toContain("increase-memory");
  });

  it("rollback-deployment in phase 2 transitions to resolved", async () => {
    const app = buildApp();
    const start = await startSession(app);

    // Advance to phase 2
    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");

    // Roll back
    const result = await takeAction(app, start.session.id, "rollback-deployment");

    expect(result.phase_transition).toBeDefined();
    expect(result.phase_transition!.from).toBe("root-cause-identified");
    expect(result.phase_transition!.to).toBe("resolved");
    expect(result.telemetry.dashboard_state).toBe("normal");

    // Resolved phase has no actions
    expect(result.available_actions.length).toBe(0);
  });

  it("full golden path through debrief", async () => {
    const app = buildApp();
    const start = await startSession(app);

    // Observe -> observe -> rollback
    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");
    await takeAction(app, start.session.id, "rollback-deployment");

    // Mock Gemini to return a debrief praising diagnostic observation
    const cleanup = mockGeminiDebrief({
      good_judgment_moments: [
        {
          action: "Checked logs before acting",
          why_it_was_good: "Observation before remediation leads to correct diagnosis",
          timestamp: "2026-01-15T14:30:00.000Z",
        },
      ],
      accountability_assessment: {
        verified: true,
        escalated_when_needed: false,
        documented_reasoning: true,
        overall: "Excellent diagnostic approach - observed before acting",
      },
    });

    try {
      const debrief = await requestDebrief(app, start.session.id);

      expect(debrief.debrief).toBeDefined();
      expect(debrief.debrief.good_judgment_moments.length).toBeGreaterThan(0);
      expect(debrief.debrief.accountability_assessment.overall).toContain("diagnostic");
      expect(debrief.session.status).toBe("completed");
    } finally {
      cleanup();
    }
  });
});

/* ====================================================================
   2. Restart-first path: start -> restart -> service fails -> observe -> fix -> debrief
   ==================================================================== */

describe("S0.4 restart-first path", () => {
  it("restart-service transitions to service-restarted phase", async () => {
    const app = buildApp();
    const start = await startSession(app);

    const result = await takeAction(app, start.session.id, "restart-service");

    expect(result.phase_transition).toBeDefined();
    expect(result.phase_transition!.from).toBe("alert-received");
    expect(result.phase_transition!.to).toBe("service-restarted");

    // Service-restarted phase narrative mentions errors returning
    expect(result.telemetry.dashboard_state).toBe("alarm");

    // Should NOT have restart-service available (already tried)
    const actionIds = result.available_actions.map((a) => a.id);
    expect(actionIds).not.toContain("restart-service");

    // Should still have observation actions
    expect(actionIds).toContain("check-logs");
    expect(actionIds).toContain("check-deployments");
  });

  it("after restart, observations advance to root-cause-identified", async () => {
    const app = buildApp();
    const start = await startSession(app);

    // Restart first
    await takeAction(app, start.session.id, "restart-service");

    // Observe twice in service-restarted phase
    await takeAction(app, start.session.id, "check-logs");
    const result = await takeAction(app, start.session.id, "check-deployments");

    expect(result.phase_transition).toBeDefined();
    expect(result.phase_transition!.from).toBe("service-restarted");
    expect(result.phase_transition!.to).toBe("root-cause-identified");
  });

  it("full restart-first path debrief coaches observe-first", async () => {
    const app = buildApp();
    const start = await startSession(app);

    // Restart first (wrong order)
    await takeAction(app, start.session.id, "restart-service");

    // Then observe
    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");

    // Fix
    await takeAction(app, start.session.id, "rollback-deployment");

    // Mock Gemini to return coaching about observe-first
    const cleanup = mockGeminiDebrief({
      missed_signals: [
        {
          signal: "Deployment correlation visible in dashboard",
          what_to_check: "Check deployment history before attempting restarts",
          when_it_was_visible: "From the start of the incident",
        },
      ],
      accountability_assessment: {
        verified: true,
        escalated_when_needed: false,
        documented_reasoning: false,
        overall: "Restarted before investigating. Next time, observe first to find lasting fixes.",
      },
    });

    try {
      const debrief = await requestDebrief(app, start.session.id);

      expect(debrief.debrief).toBeDefined();
      expect(debrief.debrief.missed_signals.length).toBeGreaterThan(0);
      expect(debrief.debrief.accountability_assessment.overall).toContain("observe");
      expect(debrief.session.status).toBe("completed");
    } finally {
      cleanup();
    }
  });
});

/* ====================================================================
   3. Observe-before-act detection (tutor prompts)
   ==================================================================== */

describe("S0.4 observe-before-act detection", () => {
  it("scenario coaching prompt instructs highlight_good_judgment for first-action observation", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context?.coaching_prompt ?? "";
    expect(coaching).toContain("FIRST action is an observation");
    expect(coaching).toContain("highlight_good_judgment");
  });

  it("scenario coaching prompt instructs gentle_nudge for first-action remediation", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context?.coaching_prompt ?? "";
    expect(coaching).toContain("FIRST action is a remediation");
    expect(coaching).toContain("gentle_nudge");
  });

  it("buildSimulationTutorPrompt includes coaching_prompt content", () => {
    const { buildSimulationTutorPrompt } = require("../simulation-tutor");
    const phase = s04FirstSoloDiagnosis.phases[0];
    const prompt = buildSimulationTutorPrompt(s04FirstSoloDiagnosis, [], phase);

    expect(prompt).toContain("OBSERVE BEFORE ACT");
    expect(prompt).toContain("highlight_good_judgment");
    expect(prompt).toContain("gentle_nudge");
  });

  it("tutor prompt includes action log when actions have been taken", () => {
    const { buildSimulationTutorPrompt } = require("../simulation-tutor");
    const phase = s04FirstSoloDiagnosis.phases[0];
    const actionLog = [
      {
        action_id: "check-logs",
        category: "observe" as const,
        label: "Check application logs",
        timestamp: "2026-01-15T14:31:00.000Z",
        diagnostic_value: "high" as const,
        phase_id: "alert-received",
      },
    ];
    const prompt = buildSimulationTutorPrompt(s04FirstSoloDiagnosis, actionLog, phase);

    expect(prompt).toContain("check-logs");
    expect(prompt).toContain("observe/Check application logs");
  });
});

/* ====================================================================
   4. Phase progression details
   ==================================================================== */

describe("S0.4 phase progression", () => {
  it("single observation does not advance phase", async () => {
    const app = buildApp();
    const start = await startSession(app);

    const result = await takeAction(app, start.session.id, "check-logs");

    expect(result.phase_transition).toBeUndefined();

    // Verify DB still shows alert-received
    const row = sqliteDb
      .prepare("SELECT current_phase FROM simulation_sessions WHERE id = ?")
      .get(start.session.id) as { current_phase: string };
    expect(row.current_phase).toBe("alert-received");
  });

  it("two different observation actions advance to root-cause-identified", async () => {
    const app = buildApp();
    const start = await startSession(app);

    const first = await takeAction(app, start.session.id, "check-memory");
    expect(first.phase_transition).toBeUndefined();

    const second = await takeAction(app, start.session.id, "check-errors");
    expect(second.phase_transition).toBeDefined();
    expect(second.phase_transition!.to).toBe("root-cause-identified");
  });

  it("root-cause-identified phase has rollback-deployment and increase-memory", async () => {
    const app = buildApp();
    const start = await startSession(app);

    await takeAction(app, start.session.id, "check-logs");
    const result = await takeAction(app, start.session.id, "check-deployments");

    const actionIds = result.available_actions.map((a) => a.id);
    expect(actionIds).toContain("rollback-deployment");
    expect(actionIds).toContain("increase-memory");
    // Should also still have observation actions
    expect(actionIds).toContain("check-logs");
  });

  it("increase-memory also resolves the scenario", async () => {
    const app = buildApp();
    const start = await startSession(app);

    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");

    const result = await takeAction(app, start.session.id, "increase-memory");

    expect(result.phase_transition).toBeDefined();
    expect(result.phase_transition!.to).toBe("resolved");
    expect(result.telemetry.dashboard_state).toBe("normal");
  });

  it("resolved phase telemetry shows normal metrics", async () => {
    const app = buildApp();
    const start = await startSession(app);

    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");
    const result = await takeAction(app, start.session.id, "rollback-deployment");

    // All metrics should be normal
    const criticalMetrics = result.telemetry.metrics.filter(
      (m) => m.status === "critical",
    );
    expect(criticalMetrics.length).toBe(0);

    // Recovery logs should be present
    const recoveryLog = result.telemetry.logs.find((l) =>
      l.message.includes("recovering"),
    );
    expect(recoveryLog).toBeDefined();
  });
});

/* ====================================================================
   5. Stall detection threshold
   ==================================================================== */

describe("S0.4 stall detection", () => {
  it("scenario defines stall_seconds as 60", () => {
    expect(s04FirstSoloDiagnosis.intervention_thresholds.stall_seconds).toBe(60);
  });

  it("tutor prompt includes stall threshold of 60 seconds", () => {
    const { buildSimulationTutorPrompt } = require("../simulation-tutor");
    const phase = s04FirstSoloDiagnosis.phases[0];
    const prompt = buildSimulationTutorPrompt(s04FirstSoloDiagnosis, [], phase);

    expect(prompt).toContain("60 seconds");
    expect(prompt).toContain("stall");
  });

  it("scenario coaching prompt mentions direct_intervention for 60+ second stall", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context?.coaching_prompt ?? "";
    expect(coaching).toContain("60+ seconds");
    expect(coaching).toContain("direct_intervention");
  });

  it("intervention thresholds include wrong_direction_count and fixation_loop_count", () => {
    expect(s04FirstSoloDiagnosis.intervention_thresholds.wrong_direction_count).toBe(2);
    expect(s04FirstSoloDiagnosis.intervention_thresholds.fixation_loop_count).toBe(3);
  });
});

/* ====================================================================
   6. Debrief content validation
   ==================================================================== */

describe("S0.4 debrief content", () => {
  it("debrief prompt includes scenario-specific debrief guidance", () => {
    const { buildDebriefPrompt } = require("../simulation-tutor");
    const events = [
      {
        id: "e1",
        session_id: "s1",
        event_type: "action" as const,
        event_data: { action_id: "check-logs", category: "observe", label: "Check application logs" },
        created_at: "2026-01-15T14:31:00.000Z",
      },
    ];
    const prompt = buildDebriefPrompt(s04FirstSoloDiagnosis, events);

    // Should include debrief-specific guidance
    expect(prompt).toContain("observe-before-act");
    expect(prompt).toContain("telemetry before attempting a fix");
    expect(prompt).toContain("learning moment");
  });

  it("debrief prompt includes trainee event log", () => {
    const { buildDebriefPrompt } = require("../simulation-tutor");
    const events = [
      {
        id: "e1",
        session_id: "s1",
        event_type: "action" as const,
        event_data: { action_id: "restart-service", category: "act", label: "Restart the service" },
        created_at: "2026-01-15T14:31:00.000Z",
      },
      {
        id: "e2",
        session_id: "s1",
        event_type: "action" as const,
        event_data: { action_id: "check-logs", category: "observe", label: "Check application logs" },
        created_at: "2026-01-15T14:32:00.000Z",
      },
    ];
    const prompt = buildDebriefPrompt(s04FirstSoloDiagnosis, events);

    expect(prompt).toContain("restart-service");
    expect(prompt).toContain("check-logs");
  });

  it("good path debrief has valid structure with Gemini mock", async () => {
    const app = buildApp();
    const start = await startSession(app);

    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");
    await takeAction(app, start.session.id, "rollback-deployment");

    const cleanup = mockGeminiDebrief({
      good_judgment_moments: [
        {
          action: "Checked logs first",
          why_it_was_good: "Systematic observation before acting",
          timestamp: "2026-01-15T14:31:00.000Z",
        },
      ],
      expert_path_comparison: {
        expert_steps: [
          "Check metrics",
          "Check logs",
          "Check deployments",
          "Roll back deployment",
        ],
        trainee_steps: [
          "Checked logs",
          "Checked deployments",
          "Rolled back deployment",
        ],
        divergence_points: [],
      },
      accountability_assessment: {
        verified: true,
        escalated_when_needed: false,
        documented_reasoning: true,
        overall: "Strong diagnostic approach with observe-before-act habit",
      },
    });

    try {
      const debrief = await requestDebrief(app, start.session.id);

      expect(debrief.debrief.good_judgment_moments).toBeArrayOfSize(1);
      expect(debrief.debrief.expert_path_comparison.expert_steps.length).toBeGreaterThan(0);
      expect(debrief.debrief.expert_path_comparison.divergence_points).toBeArrayOfSize(0);
      expect(debrief.debrief.accountability_assessment.verified).toBe(true);
      expect(debrief.debrief.accountability_assessment.overall).toContain("observe-before-act");
    } finally {
      cleanup();
    }
  });

  it("restart-first path debrief has coaching content with Gemini mock", async () => {
    const app = buildApp();
    const start = await startSession(app);

    // Restart first
    await takeAction(app, start.session.id, "restart-service");
    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");
    await takeAction(app, start.session.id, "rollback-deployment");

    const cleanup = mockGeminiDebrief({
      good_judgment_moments: [],
      missed_signals: [
        {
          signal: "Deployment v2.4.1 correlated with error onset",
          what_to_check: "Check deployment history before restarting",
          when_it_was_visible: "Visible from initial dashboard",
        },
      ],
      expert_path_comparison: {
        expert_steps: [
          "Check metrics",
          "Check logs",
          "Check deployments",
          "Roll back deployment",
        ],
        trainee_steps: [
          "Restarted service",
          "Checked logs",
          "Checked deployments",
          "Rolled back deployment",
        ],
        divergence_points: [
          "Trainee restarted service before investigating root cause",
        ],
      },
      accountability_assessment: {
        verified: false,
        escalated_when_needed: false,
        documented_reasoning: false,
        overall: "Restarted before observing. Build the observe-first habit.",
      },
    });

    try {
      const debrief = await requestDebrief(app, start.session.id);

      expect(debrief.debrief.missed_signals.length).toBeGreaterThan(0);
      expect(debrief.debrief.expert_path_comparison.divergence_points.length).toBeGreaterThan(0);
      expect(debrief.debrief.accountability_assessment.overall).toContain("observe");
    } finally {
      cleanup();
    }
  });

  it("debrief without Gemini returns minimal fallback", async () => {
    const app = buildApp();
    const start = await startSession(app);

    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");
    await takeAction(app, start.session.id, "rollback-deployment");

    // No Gemini mock - will fail and return fallback
    const debrief = await requestDebrief(app, start.session.id);

    expect(debrief.debrief).toBeDefined();
    expect(debrief.debrief.accountability_assessment.overall).toContain("fallback");
    expect(debrief.session.status).toBe("completed");
  });
});

/* ====================================================================
   7. Event recording
   ==================================================================== */

describe("S0.4 event recording", () => {
  it("records correct event count for golden path", async () => {
    const app = buildApp();
    const start = await startSession(app);

    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");
    await takeAction(app, start.session.id, "rollback-deployment");

    const events = sqliteDb
      .prepare("SELECT * FROM simulation_events WHERE session_id = ? ORDER BY created_at")
      .all(start.session.id) as Array<{ event_type: string; event_data: string }>;

    // 1 initial observation + 3 actions + 2 phase transitions = 6
    const actionEvents = events.filter((e) => e.event_type === "action");
    const transitionEvents = events.filter((e) => {
      if (e.event_type !== "observation") return false;
      const data = JSON.parse(e.event_data) as { type?: string };
      return data.type === "phase_transition";
    });

    expect(actionEvents.length).toBe(3);
    expect(transitionEvents.length).toBe(2);
  });

  it("records correct phases in transition events", async () => {
    const app = buildApp();
    const start = await startSession(app);

    await takeAction(app, start.session.id, "check-logs");
    await takeAction(app, start.session.id, "check-deployments");
    await takeAction(app, start.session.id, "rollback-deployment");

    const events = sqliteDb
      .prepare("SELECT event_data FROM simulation_events WHERE session_id = ? AND event_type = 'observation' ORDER BY created_at")
      .all(start.session.id) as Array<{ event_data: string }>;

    const transitions = events
      .map((e) => JSON.parse(e.event_data) as { type?: string; from?: string; to?: string })
      .filter((d) => d.type === "phase_transition");

    expect(transitions.length).toBe(2);
    expect(transitions[0].from).toBe("alert-received");
    expect(transitions[0].to).toBe("root-cause-identified");
    expect(transitions[1].from).toBe("root-cause-identified");
    expect(transitions[1].to).toBe("resolved");
  });
});
