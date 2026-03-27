import { describe, it, expect } from "bun:test";
import {
  buildSimulationTutorTools,
  buildSimulationTutorPrompt,
  evaluateAction,
  buildDebriefPrompt,
  generateDebrief,
} from "../simulation-tutor";
import type { ActionLogEntry, PriorSessionSummary } from "../simulation-tutor";
import type { GeminiFunctionCallResponse } from "../../lib/gemini";
import type {
  SimulationScenario,
  SimulationSession,
  SimulationEvent,
  SimulationDebrief,
  SimulationPhase,
  InterventionThresholds,
} from "@softwarepilots/shared";

/* ---- Test fixtures ---- */

const EXPECTED_TOOL_NAMES = [
  "observe_silently",
  "gentle_nudge",
  "direct_intervention",
  "highlight_good_judgment",
  "accountability_moment",
];

const EXPECTED_TOOL_COUNT = 5;

const TEST_THRESHOLDS: InterventionThresholds = {
  stall_seconds: 120,
  wrong_direction_count: 3,
  fixation_loop_count: 3,
};

const TEST_PHASE: SimulationPhase = {
  id: "phase-1",
  narrative: "The on-call engineer receives an alert about elevated error rates.",
  available_actions: [
    {
      id: "check-dashboard",
      category: "observe",
      label: "Check monitoring dashboard",
      description: "Look at the main monitoring dashboard",
      diagnostic_value: "high",
    },
  ],
  telemetry_snapshot: {
    metrics: [
      {
        name: "error_rate",
        value: 5.2,
        unit: "%",
        threshold: 1.0,
        status: "critical",
      },
      {
        name: "latency_p99",
        value: 450,
        unit: "ms",
        status: "warning",
      },
    ],
    logs: [
      {
        timestamp: "2026-03-22T10:00:00Z",
        level: "error",
        service: "api-gateway",
        message: "Connection refused to downstream service",
      },
    ],
    dashboard_state: "alarm",
  },
  triggers: [],
};

const TEST_SCENARIO: SimulationScenario = {
  id: "scenario-1",
  title: "Database Connection Pool Exhaustion",
  level: "level-1",
  tier: "introductory",
  prerequisite_scenarios: [],
  prerequisite_concepts: [],
  briefing: "You are on-call and receive an alert about rising error rates in the API gateway.",
  phases: [TEST_PHASE],
  root_causes: [
    { id: "rc-1", description: "Connection pool exhaustion due to leaked connections" },
    { id: "rc-2", description: "Missing connection timeout configuration" },
  ],
  intervention_thresholds: TEST_THRESHOLDS,
};

const TEST_ACTION_LOG: ActionLogEntry[] = [
  {
    action_id: "act-1",
    category: "observe",
    label: "Check monitoring dashboard",
    timestamp: "2026-03-22T10:01:00Z",
    diagnostic_value: "high",
    phase_id: "phase-1",
  },
  {
    action_id: "act-2",
    category: "diagnose",
    label: "Check database connection pool",
    timestamp: "2026-03-22T10:02:30Z",
    diagnostic_value: "high",
    phase_id: "phase-1",
  },
];

/* ---- Test prompt templates ---- */

const TEST_TUTOR_TEMPLATE = `You are an experienced simulation tutor observing a trainee working through an incident response scenario.

== Scenario ==
Title: {{scenario_title}}
Level: {{scenario_level}} / Tier: {{scenario_tier}}
Briefing: {{scenario_briefing}}

== Root Causes (Expert Knowledge - DO NOT reveal directly) ==
{{root_causes}}

== Expert Diagnostic Path ==
The correct approach involves identifying these root causes through systematic observation, diagnosis, and verification.
The trainee should discover these through their own investigation, not from direct hints.
{{ai_agent_block}}

== Intervention Thresholds ==
Stall threshold: {{stall_seconds}} seconds without meaningful action
Wrong direction threshold: {{wrong_direction_count}} actions in the wrong direction
Fixation loop threshold: {{fixation_loop_count}} repeated similar actions
{{coaching_block}}

== Common Misconceptions ==
Watch for the trainee:
- Fixating on a single metric without cross-referencing
- Trusting AI agent suggestions without verification
- Skipping log analysis and going straight to action
- Not escalating when signals warrant it
- Applying fixes without understanding root cause

== Current Phase ==
Phase: {{phase_id}}
Narrative: {{phase_narrative}}
Dashboard state: {{dashboard_state}}{{metrics_block}}{{logs_block}}

== Trainee Action Log ==
{{action_log}}

== Instructions ==
Choose exactly one observation tool. Default to observe_silently unless intervention criteria are met.

Intervention criteria:
- If the trainee has stalled for more than {{stall_seconds}} seconds, consider gentle_nudge or direct_intervention.
- If the trainee has taken {{wrong_direction_count}} or more wrong-direction actions, use gentle_nudge (first time) or direct_intervention (repeated).
- If the trainee is repeating the same type of action {{fixation_loop_count}} or more times (fixation loop), use gentle_nudge or direct_intervention.
- If the trainee makes a decision that demonstrates good engineering judgment, use highlight_good_judgment.
- At key decision points (before applying a fix, before escalating, before signing off), use accountability_moment.
- In all other cases, use observe_silently.

You MUST call exactly one of the provided tool functions. Never respond with plain text.`;

const TEST_DEBRIEF_TEMPLATE = `You are an expert simulation debrief analyst. Your job is to produce a structured JSON debrief of a trainee's performance in an incident response simulation.

== Scenario Context ==
Title: {{scenario_title}}
Level: {{scenario_level}} / Tier: {{scenario_tier}}
Briefing: {{scenario_briefing}}

== Root Causes (the correct answers) ==
{{root_causes}}

== Expert Diagnostic Path ==
The ideal approach involves systematically identifying each root cause through observation, diagnosis, and verification.
Expert steps should include: reviewing metrics, checking logs, correlating signals, diagnosing root cause, verifying fix, escalating if needed.
{{ai_agent_block}}

== Full Event Log ==
{{event_log}}
{{tutor_observations_block}}
{{agent_interactions_block}}
{{prior_sessions_block}}
{{debrief_guidance_block}}

== Output Format ==
Return ONLY valid JSON matching this exact structure (no markdown, no backticks, no explanation):
{{output_schema}}

Rules:
- Populate arrays based on actual event data. If the trainee did nothing notable, use empty arrays.
- For timestamps, use the event timestamps from the log.
- For expert_steps, describe what an expert would do for this specific scenario.
- For trainee_steps, describe what the trainee actually did based on the event log.
- Be specific and reference actual events, not generic advice.
- Return ONLY the JSON object. No surrounding text, markdown, or code fences.`;

/* ---- Mock DB for prompt fetching ---- */

function createMockPromptDB(): D1Database {
  const prompts: Record<string, string> = {
    "simulation.tutor": TEST_TUTOR_TEMPLATE,
    "simulation.debrief": TEST_DEBRIEF_TEMPLATE,
  };
  return {
    prepare() {
      return {
        bind(key: string) {
          return {
            async first() {
              const content = prompts[key];
              if (!content) return null;
              return { id: 1, key, content, version: 1, deleted: 0, created_at: "2026-01-01", created_by: null, reason: null };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

/* ---- buildSimulationTutorTools ---- */

describe("buildSimulationTutorTools", () => {
  it("returns exactly 5 tool declarations", () => {
    const tools = buildSimulationTutorTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].functionDeclarations).toHaveLength(EXPECTED_TOOL_COUNT);
  });

  it("includes all expected tool names", () => {
    const tools = buildSimulationTutorTools();
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    for (const name of EXPECTED_TOOL_NAMES) {
      expect(names).toContain(name);
    }
  });

  it("observe_silently has reasoning parameter", () => {
    const tools = buildSimulationTutorTools();
    const observe = tools[0].functionDeclarations.find(
      (d) => d.name === "observe_silently"
    );
    expect(observe).toBeDefined();
    const params = observe!.parameters as Record<string, unknown>;
    const props = (params as { properties: Record<string, unknown> }).properties;
    expect(props).toHaveProperty("reasoning");
  });

  it("gentle_nudge has observation, hint, and confidence parameters", () => {
    const tools = buildSimulationTutorTools();
    const nudge = tools[0].functionDeclarations.find(
      (d) => d.name === "gentle_nudge"
    );
    const params = nudge!.parameters as { properties: Record<string, unknown> };
    expect(params.properties).toHaveProperty("observation");
    expect(params.properties).toHaveProperty("hint");
    expect(params.properties).toHaveProperty("confidence");
  });

  it("direct_intervention has observation, guidance, and severity parameters", () => {
    const tools = buildSimulationTutorTools();
    const intervention = tools[0].functionDeclarations.find(
      (d) => d.name === "direct_intervention"
    );
    const params = intervention!.parameters as { properties: Record<string, unknown> };
    expect(params.properties).toHaveProperty("observation");
    expect(params.properties).toHaveProperty("guidance");
    expect(params.properties).toHaveProperty("severity");
  });

  it("highlight_good_judgment has decision and why_it_matters parameters", () => {
    const tools = buildSimulationTutorTools();
    const highlight = tools[0].functionDeclarations.find(
      (d) => d.name === "highlight_good_judgment"
    );
    const params = highlight!.parameters as { properties: Record<string, unknown> };
    expect(params.properties).toHaveProperty("decision");
    expect(params.properties).toHaveProperty("why_it_matters");
  });

  it("accountability_moment has decision_context, probe_question, and dimension parameters", () => {
    const tools = buildSimulationTutorTools();
    const accountability = tools[0].functionDeclarations.find(
      (d) => d.name === "accountability_moment"
    );
    const params = accountability!.parameters as { properties: Record<string, unknown> };
    expect(params.properties).toHaveProperty("decision_context");
    expect(params.properties).toHaveProperty("probe_question");
    expect(params.properties).toHaveProperty("dimension");
  });

  it("accountability_moment dimension enum has correct values", () => {
    const tools = buildSimulationTutorTools();
    const accountability = tools[0].functionDeclarations.find(
      (d) => d.name === "accountability_moment"
    );
    const params = accountability!.parameters as {
      properties: { dimension: { enum: string[] } };
    };
    expect(params.properties.dimension.enum).toEqual([
      "diagnosis",
      "verification",
      "escalation",
      "sign_off",
    ]);
  });
});

/* ---- buildSimulationTutorPrompt ---- */

describe("buildSimulationTutorPrompt", () => {
  it("includes scenario title and briefing", () => {
    const prompt = buildSimulationTutorPrompt(TEST_SCENARIO, [], TEST_PHASE, TEST_TUTOR_TEMPLATE);
    expect(prompt).toContain(TEST_SCENARIO.title);
    expect(prompt).toContain(TEST_SCENARIO.briefing);
  });

  it("includes root causes", () => {
    const prompt = buildSimulationTutorPrompt(TEST_SCENARIO, [], TEST_PHASE, TEST_TUTOR_TEMPLATE);
    expect(prompt).toContain("rc-1");
    expect(prompt).toContain("Connection pool exhaustion");
    expect(prompt).toContain("rc-2");
    expect(prompt).toContain("Missing connection timeout");
  });

  it("includes intervention thresholds", () => {
    const prompt = buildSimulationTutorPrompt(TEST_SCENARIO, [], TEST_PHASE, TEST_TUTOR_TEMPLATE);
    expect(prompt).toContain("120 seconds");
    expect(prompt).toContain("3 or more wrong-direction actions");
    expect(prompt).toContain("3 or more times");
  });

  it("includes current phase telemetry", () => {
    const prompt = buildSimulationTutorPrompt(TEST_SCENARIO, [], TEST_PHASE, TEST_TUTOR_TEMPLATE);
    expect(prompt).toContain("error_rate");
    expect(prompt).toContain("5.2");
    expect(prompt).toContain("critical");
    expect(prompt).toContain("alarm");
  });

  it("includes current phase logs", () => {
    const prompt = buildSimulationTutorPrompt(TEST_SCENARIO, [], TEST_PHASE, TEST_TUTOR_TEMPLATE);
    expect(prompt).toContain("api-gateway");
    expect(prompt).toContain("Connection refused");
  });

  it("shows 'No actions taken yet' for empty action log", () => {
    const prompt = buildSimulationTutorPrompt(TEST_SCENARIO, [], TEST_PHASE, TEST_TUTOR_TEMPLATE);
    expect(prompt).toContain("No actions taken yet");
  });

  it("includes action log entries with timestamps", () => {
    const prompt = buildSimulationTutorPrompt(
      TEST_SCENARIO,
      TEST_ACTION_LOG,
      TEST_PHASE,
      TEST_TUTOR_TEMPLATE
    );
    expect(prompt).toContain("2026-03-22T10:01:00Z");
    expect(prompt).toContain("Check monitoring dashboard");
    expect(prompt).toContain("Check database connection pool");
  });

  it("instructs to choose exactly one observation tool", () => {
    const prompt = buildSimulationTutorPrompt(TEST_SCENARIO, [], TEST_PHASE, TEST_TUTOR_TEMPLATE);
    expect(prompt).toContain(
      "Choose exactly one observation tool. Default to observe_silently unless intervention criteria are met."
    );
  });

  it("does not contain em-dashes", () => {
    const prompt = buildSimulationTutorPrompt(
      TEST_SCENARIO,
      TEST_ACTION_LOG,
      TEST_PHASE,
      TEST_TUTOR_TEMPLATE
    );
    expect(prompt).not.toContain("\u2014"); // em-dash
    expect(prompt).not.toContain("\u2013"); // en-dash
  });

  it("includes AI agent behavior when present", () => {
    const scenarioWithAgent: SimulationScenario = {
      ...TEST_SCENARIO,
      ai_agent_behavior: {
        behavior: "sometimes_wrong",
        personality: "Eager but imprecise",
        knowledge_gaps: ["connection pooling", "timeout configurations"],
      },
    };
    const prompt = buildSimulationTutorPrompt(
      scenarioWithAgent,
      [],
      TEST_PHASE,
      TEST_TUTOR_TEMPLATE
    );
    expect(prompt).toContain("sometimes_wrong");
    expect(prompt).toContain("Eager but imprecise");
    expect(prompt).toContain("connection pooling");
  });

  it("includes tutor_context coaching prompt when present", () => {
    const scenarioWithTutor: SimulationScenario = {
      ...TEST_SCENARIO,
      tutor_context: {
        coaching_prompt: "Primary teaching goal: OBSERVE BEFORE ACT",
        debrief_prompt: "Focus the debrief on observe-before-act habit",
      },
    };
    const prompt = buildSimulationTutorPrompt(
      scenarioWithTutor,
      [],
      TEST_PHASE,
      TEST_TUTOR_TEMPLATE
    );
    expect(prompt).toContain("Scenario-Specific Coaching");
    expect(prompt).toContain("OBSERVE BEFORE ACT");
  });

  it("does not include coaching section when tutor_context is absent", () => {
    const prompt = buildSimulationTutorPrompt(TEST_SCENARIO, [], TEST_PHASE, TEST_TUTOR_TEMPLATE);
    expect(prompt).not.toContain("Scenario-Specific Coaching");
  });
});

/* ---- evaluateAction graceful degradation ---- */

describe("evaluateAction", () => {
  it("returns observe_silently with error metadata when Gemini call fails", async () => {
    // Create a mock env with an invalid API key to trigger failure
    const mockEnv = {
      GEMINI_API_KEY: "invalid-key-that-will-fail",
      GEMINI_MODEL: "nonexistent-model",
      DB: createMockPromptDB(),
      EVALUATOR: {} as unknown,
      ENVIRONMENT: "test",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
      JWT_SECRET: "",
      WEB_APP_URL: "",
      ADMIN_API_KEY: "",
    } as unknown as import("../../env").Env;

    const result = await evaluateAction(
      mockEnv,
      TEST_ACTION_LOG,
      TEST_SCENARIO,
      TEST_PHASE,
      TEST_THRESHOLDS
    );

    expect(result.tool).toBe("observe_silently");
    expect(result.visible).toBe(false);
    expect(result.metadata).toHaveProperty("error", true);
  });
});

/* ---- Debrief test fixtures ---- */

const TEST_SESSION: SimulationSession = {
  id: "session-debrief-1",
  learner_id: "learner-1",
  scenario_id: "scenario-1",
  profile: "level-1",
  status: "active",
  current_phase: "phase-1",
  started_at: "2026-03-22T10:00:00Z",
};

const TEST_EVENTS: SimulationEvent[] = [
  {
    id: "evt-1",
    session_id: "session-debrief-1",
    event_type: "observation",
    event_data: { type: "session_started", phase: "phase-1" },
    created_at: "2026-03-22T10:00:00Z",
  },
  {
    id: "evt-2",
    session_id: "session-debrief-1",
    event_type: "action",
    event_data: { action_id: "check-dashboard", category: "observe", label: "Check monitoring dashboard" },
    created_at: "2026-03-22T10:01:00Z",
  },
  {
    id: "evt-3",
    session_id: "session-debrief-1",
    event_type: "agent_query",
    event_data: { message: "What should I check?", response: "Try the logs" },
    created_at: "2026-03-22T10:02:00Z",
  },
  {
    id: "evt-4",
    session_id: "session-debrief-1",
    event_type: "tutor_intervention",
    event_data: { tool: "gentle_nudge", hint: "Look at error rates" },
    created_at: "2026-03-22T10:03:00Z",
  },
];

const TEST_PRIOR_SESSIONS: PriorSessionSummary[] = [
  {
    session_id: "prev-session-1",
    completed_at: "2026-03-21T15:00:00Z",
    debrief: {
      good_judgment_moments: [{ action: "Checked logs", why_it_was_good: "Good instinct", timestamp: "2026-03-21T14:01:00Z" }],
      missed_signals: [],
      expert_path_comparison: {
        expert_steps: ["Check metrics", "Check logs"],
        trainee_steps: ["Check logs"],
        divergence_points: ["Skipped metrics"],
      },
      accountability_assessment: {
        verified: false,
        escalated_when_needed: false,
        documented_reasoning: false,
        overall: "Needs improvement on verification",
      },
    },
  },
];

/* ---- buildDebriefPrompt ---- */

describe("buildDebriefPrompt", () => {
  it("includes scenario context", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain(TEST_SCENARIO.title);
    expect(prompt).toContain(TEST_SCENARIO.briefing);
    expect(prompt).toContain(TEST_SCENARIO.tier);
  });

  it("includes root causes", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("rc-1");
    expect(prompt).toContain("Connection pool exhaustion");
    expect(prompt).toContain("rc-2");
  });

  it("includes full event log with timestamps", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("2026-03-22T10:00:00Z");
    expect(prompt).toContain("session_started");
    expect(prompt).toContain("check-dashboard");
  });

  it("includes agent interactions section when present", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("AI Agent Interactions");
    expect(prompt).toContain("What should I check?");
  });

  it("includes tutor observations section when present", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("Tutor Observations");
    expect(prompt).toContain("gentle_nudge");
  });

  it("includes AI agent config when scenario has one", () => {
    const scenarioWithAgent: SimulationScenario = {
      ...TEST_SCENARIO,
      ai_agent_behavior: {
        behavior: "confidently_wrong",
        personality: "Overconfident senior dev",
        knowledge_gaps: ["connection pooling"],
      },
    };
    const prompt = buildDebriefPrompt(scenarioWithAgent, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("confidently_wrong");
    expect(prompt).toContain("Overconfident senior dev");
    expect(prompt).toContain("connection pooling");
  });

  it("includes output format instructions with JSON structure", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("good_judgment_moments");
    expect(prompt).toContain("missed_signals");
    expect(prompt).toContain("expert_path_comparison");
    expect(prompt).toContain("accountability_assessment");
    expect(prompt).toContain("Return ONLY valid JSON");
  });

  it("handles empty event log", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, [], TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("No events recorded");
  });

  it("includes prior sessions for progression when provided", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE, TEST_PRIOR_SESSIONS);
    expect(prompt).toContain("Prior Session Attempts");
    expect(prompt).toContain("prev-session-1");
    expect(prompt).toContain("1 prior attempt(s)");
    expect(prompt).toContain("progression");
  });

  it("does not include progression section when no prior sessions", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).not.toContain("Prior Session Attempts");
  });

  it("includes tutor_context debrief prompt when present", () => {
    const scenarioWithTutor: SimulationScenario = {
      ...TEST_SCENARIO,
      tutor_context: {
        coaching_prompt: "Primary teaching goal: OBSERVE BEFORE ACT",
        debrief_prompt: "Focus the debrief on observe-before-act habit",
      },
    };
    const prompt = buildDebriefPrompt(scenarioWithTutor, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("Scenario-Specific Debrief Guidance");
    expect(prompt).toContain("observe-before-act habit");
  });

  it("does not include debrief guidance section when tutor_context is absent", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE);
    expect(prompt).not.toContain("Scenario-Specific Debrief Guidance");
  });

  it("does not contain em-dashes", () => {
    const prompt = buildDebriefPrompt(TEST_SCENARIO, TEST_EVENTS, TEST_DEBRIEF_TEMPLATE, TEST_PRIOR_SESSIONS);
    expect(prompt).not.toContain("\u2014"); // em-dash
    expect(prompt).not.toContain("\u2013"); // en-dash
  });
});

/* ---- generateDebrief graceful degradation ---- */

describe("generateDebrief", () => {
  it("returns minimal fallback debrief when Gemini call fails", async () => {
    const mockEnv = {
      GEMINI_API_KEY: "invalid-key-that-will-fail",
      GEMINI_MODEL: "nonexistent-model",
      DB: createMockPromptDB(),
    } as unknown as import("../../env").Env;

    const result = await generateDebrief(
      mockEnv,
      TEST_SESSION,
      TEST_EVENTS,
      TEST_SCENARIO,
    );

    expect(result).toBeDefined();
    expect(result.accountability_assessment.overall).toContain("fallback");
    expect(Array.isArray(result.good_judgment_moments)).toBe(true);
    expect(Array.isArray(result.missed_signals)).toBe(true);
    expect(Array.isArray(result.expert_path_comparison.expert_steps)).toBe(true);
    expect(Array.isArray(result.expert_path_comparison.trainee_steps)).toBe(true);
    expect(Array.isArray(result.expert_path_comparison.divergence_points)).toBe(true);
  });

  it("fallback debrief includes trainee steps from action events", async () => {
    const mockEnv = {
      GEMINI_API_KEY: "invalid-key",
      GEMINI_MODEL: "nonexistent",
      DB: createMockPromptDB(),
    } as unknown as import("../../env").Env;

    const result = await generateDebrief(
      mockEnv,
      TEST_SESSION,
      TEST_EVENTS,
      TEST_SCENARIO,
    );

    // Should extract trainee steps from action events
    expect(result.expert_path_comparison.trainee_steps.length).toBeGreaterThan(0);
    expect(result.expert_path_comparison.trainee_steps[0]).toContain("Check monitoring dashboard");
  });

  it("returns valid debrief structure with all required fields", async () => {
    const mockEnv = {
      GEMINI_API_KEY: "invalid-key",
      GEMINI_MODEL: "nonexistent",
      DB: createMockPromptDB(),
    } as unknown as import("../../env").Env;

    const result = await generateDebrief(
      mockEnv,
      TEST_SESSION,
      TEST_EVENTS,
      TEST_SCENARIO,
    );

    // Verify the full SimulationDebrief shape
    expect(result).toHaveProperty("good_judgment_moments");
    expect(result).toHaveProperty("missed_signals");
    expect(result).toHaveProperty("expert_path_comparison");
    expect(result.expert_path_comparison).toHaveProperty("expert_steps");
    expect(result.expert_path_comparison).toHaveProperty("trainee_steps");
    expect(result.expert_path_comparison).toHaveProperty("divergence_points");
    expect(result).toHaveProperty("accountability_assessment");
    expect(result.accountability_assessment).toHaveProperty("verified");
    expect(result.accountability_assessment).toHaveProperty("escalated_when_needed");
    expect(result.accountability_assessment).toHaveProperty("documented_reasoning");
    expect(result.accountability_assessment).toHaveProperty("overall");
    expect(typeof result.accountability_assessment.verified).toBe("boolean");
    expect(typeof result.accountability_assessment.escalated_when_needed).toBe("boolean");
    expect(typeof result.accountability_assessment.documented_reasoning).toBe("boolean");
  });

  it("does not include progression when no prior sessions provided", async () => {
    const mockEnv = {
      GEMINI_API_KEY: "invalid-key",
      GEMINI_MODEL: "nonexistent",
      DB: createMockPromptDB(),
    } as unknown as import("../../env").Env;

    const result = await generateDebrief(
      mockEnv,
      TEST_SESSION,
      TEST_EVENTS,
      TEST_SCENARIO,
    );

    expect(result.progression).toBeUndefined();
  });
});

/* ---- S0.4 scenario tutor context integration ---- */

describe("S0.4 tutor context integration", () => {
  // Import the actual scenario to verify tutor_context is configured
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { s04FirstSoloDiagnosis } = require("@softwarepilots/shared");

  it("has tutor_context defined", () => {
    expect(s04FirstSoloDiagnosis.tutor_context).toBeDefined();
  });

  it("coaching_prompt includes OBSERVE BEFORE ACT goal", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("OBSERVE BEFORE ACT");
  });

  it("coaching_prompt covers gentle_nudge for remediation-first actions", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("gentle_nudge");
    expect(coaching).toContain("restart-service");
  });

  it("coaching_prompt covers highlight_good_judgment for observation-first actions", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("highlight_good_judgment");
    expect(coaching).toContain("check-logs");
  });

  it("coaching_prompt covers direct_intervention for stalling", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("direct_intervention");
    expect(coaching).toContain("60+ seconds");
  });

  it("coaching_prompt covers accountability_moment for fix decisions", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("accountability_moment");
    expect(coaching).toContain("rollback");
  });

  it("coaching_prompt uses simple encouraging language", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("simple, encouraging language");
    expect(coaching).toContain("Do NOT criticize");
  });

  it("debrief_prompt focuses on observe-before-act habit", () => {
    const debrief = s04FirstSoloDiagnosis.tutor_context!.debrief_prompt;
    expect(debrief).toContain("observe-before-act");
    expect(debrief).toContain("telemetry");
  });

  it("debrief_prompt includes expert path comparison", () => {
    const debrief = s04FirstSoloDiagnosis.tutor_context!.debrief_prompt;
    expect(debrief).toContain("check metrics");
    expect(debrief).toContain("check logs");
    expect(debrief).toContain("check deployments");
    expect(debrief).toContain("roll back");
  });

  it("debrief_prompt frames restart-first as learning moment", () => {
    const debrief = s04FirstSoloDiagnosis.tutor_context!.debrief_prompt;
    expect(debrief).toContain("learning moment, not a failure");
  });

  it("coaching prompt integrates into tutor system prompt", () => {
    const prompt = buildSimulationTutorPrompt(
      s04FirstSoloDiagnosis,
      [],
      s04FirstSoloDiagnosis.phases[0],
      TEST_TUTOR_TEMPLATE
    );
    expect(prompt).toContain("Scenario-Specific Coaching");
    expect(prompt).toContain("OBSERVE BEFORE ACT");
  });

  it("debrief prompt integrates into debrief system prompt", () => {
    const prompt = buildDebriefPrompt(s04FirstSoloDiagnosis, [], TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("Scenario-Specific Debrief Guidance");
    expect(prompt).toContain("observe-before-act");
  });

  it("tutor_context does not contain em-dashes", () => {
    const coaching = s04FirstSoloDiagnosis.tutor_context!.coaching_prompt;
    const debrief = s04FirstSoloDiagnosis.tutor_context!.debrief_prompt;
    expect(coaching).not.toContain("\u2014");
    expect(coaching).not.toContain("\u2013");
    expect(debrief).not.toContain("\u2014");
    expect(debrief).not.toContain("\u2013");
  });
});

/* ---- S1.1 scenario tutor context and agent prompt integration ---- */

describe("S1.1 tutor context and agent prompt integration", () => {
  const { s1_1_falseGreenTestSuite } = require("@softwarepilots/shared");

  it("has tutor_context defined", () => {
    expect(s1_1_falseGreenTestSuite.tutor_context).toBeDefined();
  });

  it("coaching_prompt includes VERIFICATION DISCIPLINE goal", () => {
    const coaching = s1_1_falseGreenTestSuite.tutor_context!.coaching_prompt;
    expect(coaching).toContain("VERIFICATION DISCIPLINE");
  });

  it("coaching_prompt covers all five tutor tools", () => {
    const coaching = s1_1_falseGreenTestSuite.tutor_context!.coaching_prompt;
    expect(coaching).toContain("accountability_moment");
    expect(coaching).toContain("highlight_good_judgment");
    expect(coaching).toContain("gentle_nudge");
    expect(coaching).toContain("observe_silently");
    expect(coaching).toContain("direct_intervention");
  });

  it("debrief_prompt focuses on agent trust calibration", () => {
    const debrief = s1_1_falseGreenTestSuite.tutor_context!.debrief_prompt;
    expect(debrief).toContain("agent trust calibration");
    expect(debrief).toContain("Over-trust");
    expect(debrief).toContain("Under-trust");
    expect(debrief).toContain("Calibrated");
  });

  it("debrief_prompt includes expert path", () => {
    const debrief = s1_1_falseGreenTestSuite.tutor_context!.debrief_prompt;
    expect(debrief).toContain("view latency breakdown");
    expect(debrief).toContain("add request queuing");
  });

  it("has agent_system_prompt configured for caching misdiagnosis", () => {
    const prompt = s1_1_falseGreenTestSuite.ai_agent_behavior!.agent_system_prompt;
    expect(prompt).toBeDefined();
    expect(prompt).toContain("cache invalidation problem");
    expect(prompt).toContain("genuinely believe");
  });

  it("coaching prompt integrates into tutor system prompt", () => {
    const prompt = buildSimulationTutorPrompt(
      s1_1_falseGreenTestSuite,
      [],
      s1_1_falseGreenTestSuite.phases[0],
      TEST_TUTOR_TEMPLATE
    );
    expect(prompt).toContain("Scenario-Specific Coaching");
    expect(prompt).toContain("VERIFICATION DISCIPLINE");
  });

  it("debrief prompt integrates into debrief system prompt", () => {
    const prompt = buildDebriefPrompt(s1_1_falseGreenTestSuite, [], TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("Scenario-Specific Debrief Guidance");
    expect(prompt).toContain("agent trust calibration");
  });

  it("tutor_context and agent_system_prompt do not contain em-dashes", () => {
    const coaching = s1_1_falseGreenTestSuite.tutor_context!.coaching_prompt;
    const debrief = s1_1_falseGreenTestSuite.tutor_context!.debrief_prompt;
    const agentPrompt = s1_1_falseGreenTestSuite.ai_agent_behavior!.agent_system_prompt!;
    for (const text of [coaching, debrief, agentPrompt]) {
      expect(text).not.toContain("\u2014");
      expect(text).not.toContain("\u2013");
    }
  });
});

/* ---- S10.1 scenario tutor context and agent prompt integration ---- */

describe("S10.1 tutor context and agent prompt integration", () => {
  const { s101AgentAssistedDiagnosis } = require("@softwarepilots/shared");

  it("has tutor_context defined", () => {
    expect(s101AgentAssistedDiagnosis.tutor_context).toBeDefined();
  });

  it("coaching_prompt includes INDEPENDENT REASONING goal", () => {
    const coaching = s101AgentAssistedDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("INDEPENDENT REASONING");
    expect(coaching).toContain("DELEGATION DECISIONS");
  });

  it("coaching_prompt covers accountability_moment for following AI blindly", () => {
    const coaching = s101AgentAssistedDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("accountability_moment");
    expect(coaching).toContain("database fix without checking");
  });

  it("coaching_prompt covers highlight_good_judgment for independent checks", () => {
    const coaching = s101AgentAssistedDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("highlight_good_judgment");
    expect(coaching).toContain("connection pools or retry logs independently");
  });

  it("coaching_prompt covers gentle_nudge for fixation and tunnel vision", () => {
    const coaching = s101AgentAssistedDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("gentle_nudge");
    expect(coaching).toContain("3+ times");
    expect(coaching).toContain("only investigates one service");
  });

  it("coaching_prompt covers observe_silently for failed DB fix", () => {
    const coaching = s101AgentAssistedDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("observe_silently");
    expect(coaching).toContain("database fix and it fails");
  });

  it("coaching_prompt uses peer-to-peer language for Level 10", () => {
    const coaching = s101AgentAssistedDiagnosis.tutor_context!.coaching_prompt;
    expect(coaching).toContain("Level 10 veteran engineer");
    expect(coaching).toContain("Speak as a peer");
    expect(coaching).toContain("Do not condescend");
  });

  it("debrief_prompt focuses on independent reasoning and authority bias", () => {
    const debrief = s101AgentAssistedDiagnosis.tutor_context!.debrief_prompt;
    expect(debrief).toContain("independent reasoning");
    expect(debrief).toContain("authority bias");
  });

  it("debrief_prompt includes expert path for S10.1", () => {
    const debrief = s101AgentAssistedDiagnosis.tutor_context!.debrief_prompt;
    expect(debrief).toContain("dependency map");
    expect(debrief).toContain("connection pools");
    expect(debrief).toContain("retry logs");
    expect(debrief).toContain("circuit breaker");
  });

  it("debrief_prompt uses direct analytical tone for veterans", () => {
    const debrief = s101AgentAssistedDiagnosis.tutor_context!.debrief_prompt;
    expect(debrief).toContain("direct and analytical");
    expect(debrief).toContain("honest assessment");
  });

  it("has agent_system_prompt configured for database misdiagnosis", () => {
    const prompt = s101AgentAssistedDiagnosis.ai_agent_behavior!.agent_system_prompt;
    expect(prompt).toBeDefined();
    expect(prompt).toContain("database performance issue");
    expect(prompt).toContain("CONFIDENT and AUTHORITATIVE");
  });

  it("agent_system_prompt has behavior escalation with partial concession", () => {
    const prompt = s101AgentAssistedDiagnosis.ai_agent_behavior!.agent_system_prompt!;
    expect(prompt).toContain("Initial question");
    expect(prompt).toContain("Directly confronted");
    expect(prompt).toContain("Never fully admit you are wrong");
  });

  it("coaching prompt integrates into tutor system prompt", () => {
    const prompt = buildSimulationTutorPrompt(
      s101AgentAssistedDiagnosis,
      [],
      s101AgentAssistedDiagnosis.phases[0],
      TEST_TUTOR_TEMPLATE
    );
    expect(prompt).toContain("Scenario-Specific Coaching");
    expect(prompt).toContain("INDEPENDENT REASONING");
  });

  it("debrief prompt integrates into debrief system prompt", () => {
    const prompt = buildDebriefPrompt(s101AgentAssistedDiagnosis, [], TEST_DEBRIEF_TEMPLATE);
    expect(prompt).toContain("Scenario-Specific Debrief Guidance");
    expect(prompt).toContain("independent reasoning");
  });

  it("tutor system prompt includes AI agent behavior section", () => {
    const prompt = buildSimulationTutorPrompt(
      s101AgentAssistedDiagnosis,
      [],
      s101AgentAssistedDiagnosis.phases[0],
      TEST_TUTOR_TEMPLATE
    );
    expect(prompt).toContain("AI Agent Behavior");
    expect(prompt).toContain("confidently_wrong");
    expect(prompt).toContain("retry storms");
  });

  it("tutor_context and agent_system_prompt do not contain em-dashes", () => {
    const coaching = s101AgentAssistedDiagnosis.tutor_context!.coaching_prompt;
    const debrief = s101AgentAssistedDiagnosis.tutor_context!.debrief_prompt;
    const agentPrompt = s101AgentAssistedDiagnosis.ai_agent_behavior!.agent_system_prompt!;
    for (const text of [coaching, debrief, agentPrompt]) {
      expect(text).not.toContain("\u2014");
      expect(text).not.toContain("\u2013");
    }
  });
});
