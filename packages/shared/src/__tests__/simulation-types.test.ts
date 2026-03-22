import { describe, it, expect } from "vitest";
import type {
  SimulationScenario,
  SimulationPhase,
  TelemetrySnapshot,
  SimulationAction,
  InterventionThresholds,
  AIAgentConfig,
  RootCause,
  PhaseTrigger,
  MetricDataPoint,
  LogEntry,
  TraceSpan,
  SimulationSession,
  SimulationEvent,
  TutorObservation,
  SimulationDebrief,
} from "../simulation";

/**
 * These tests verify that the simulation type system is structurally sound
 * by constructing valid instances and checking key properties. Since these
 * are pure TypeScript interfaces, the primary verification is that the
 * module compiles and exports correctly - runtime checks confirm the
 * shapes are usable in practice.
 */

const SAMPLE_METRIC: MetricDataPoint = {
  name: "p99_latency",
  value: 450,
  unit: "ms",
  threshold: 500,
  status: "warning",
};

const SAMPLE_LOG: LogEntry = {
  timestamp: "2026-03-22T10:00:00Z",
  level: "error",
  service: "auth-service",
  message: "Connection pool exhausted",
};

const SAMPLE_TRACE: TraceSpan = {
  trace_id: "abc123",
  span_id: "span-1",
  service: "api-gateway",
  operation: "POST /login",
  duration_ms: 1200,
  status: "error",
  attributes: { "http.status_code": "503" },
};

const SAMPLE_TELEMETRY: TelemetrySnapshot = {
  metrics: [SAMPLE_METRIC],
  logs: [SAMPLE_LOG],
  traces: [SAMPLE_TRACE],
  dashboard_state: "degraded",
};

const SAMPLE_ACTION: SimulationAction = {
  id: "check-logs",
  category: "observe",
  label: "Check service logs",
  description: "Review recent log entries for the auth service",
  diagnostic_value: "high",
  phase_trigger: "phase-2",
};

const SAMPLE_TRIGGER: PhaseTrigger = {
  id: "trigger-1",
  condition: "action:check-logs",
  target_phase: "phase-2",
};

const SAMPLE_PHASE: SimulationPhase = {
  id: "phase-1",
  narrative: "Users report intermittent login failures.",
  available_actions: [SAMPLE_ACTION],
  telemetry_snapshot: SAMPLE_TELEMETRY,
  triggers: [SAMPLE_TRIGGER],
};

const SAMPLE_ROOT_CAUSE: RootCause = {
  id: "rc-1",
  description: "Connection pool sized too small for traffic spike",
};

const SAMPLE_THRESHOLDS: InterventionThresholds = {
  stall_seconds: 120,
  wrong_direction_count: 3,
  fixation_loop_count: 2,
};

const SAMPLE_AI_CONFIG: AIAgentConfig = {
  behavior: "sometimes_wrong",
  personality: "Eager junior engineer who jumps to conclusions",
  knowledge_gaps: ["connection pooling", "load balancing"],
};

const SAMPLE_SCENARIO: SimulationScenario = {
  id: "S1.1",
  title: "The Login Storm",
  level: "level-1",
  tier: "introductory",
  prerequisite_scenarios: [],
  prerequisite_concepts: ["observability-basics"],
  briefing: "A sudden spike in failed logins has been reported.",
  phases: [SAMPLE_PHASE],
  root_causes: [SAMPLE_ROOT_CAUSE],
  ai_agent_behavior: SAMPLE_AI_CONFIG,
  intervention_thresholds: SAMPLE_THRESHOLDS,
};

describe("simulation type system", () => {
  describe("SimulationScenario", () => {
    it("has all required fields", () => {
      expect(SAMPLE_SCENARIO.id).toBe("S1.1");
      expect(SAMPLE_SCENARIO.level).toBe("level-1");
      expect(SAMPLE_SCENARIO.tier).toBe("introductory");
      expect(SAMPLE_SCENARIO.phases).toHaveLength(1);
      expect(SAMPLE_SCENARIO.root_causes).toHaveLength(1);
    });

    it("ai_agent_behavior is optional", () => {
      const withoutAgent: SimulationScenario = {
        ...SAMPLE_SCENARIO,
        ai_agent_behavior: undefined,
      };
      expect(withoutAgent.ai_agent_behavior).toBeUndefined();
    });
  });

  describe("TelemetrySnapshot", () => {
    it("contains metrics, logs, and optional traces", () => {
      expect(SAMPLE_TELEMETRY.metrics).toHaveLength(1);
      expect(SAMPLE_TELEMETRY.logs).toHaveLength(1);
      expect(SAMPLE_TELEMETRY.traces).toHaveLength(1);
      expect(SAMPLE_TELEMETRY.dashboard_state).toBe("degraded");
    });

    it("traces are optional", () => {
      const noTraces: TelemetrySnapshot = {
        metrics: [],
        logs: [],
        dashboard_state: "normal",
      };
      expect(noTraces.traces).toBeUndefined();
    });
  });

  describe("SimulationAction", () => {
    it("phase_trigger is optional", () => {
      const noTrigger: SimulationAction = {
        id: "noop",
        category: "diagnose",
        label: "Run diagnostics",
        description: "Generic diagnostic action",
        diagnostic_value: "medium",
      };
      expect(noTrigger.phase_trigger).toBeUndefined();
    });
  });

  describe("session types", () => {
    it("SimulationSession has required fields", () => {
      const session: SimulationSession = {
        id: "sess-1",
        learner_id: "user-1",
        scenario_id: "S1.1",
        profile: "level-1",
        status: "active",
        current_phase: "phase-1",
        started_at: "2026-03-22T10:00:00Z",
      };
      expect(session.status).toBe("active");
      expect(session.completed_at).toBeUndefined();
    });

    it("SimulationEvent captures action data", () => {
      const event: SimulationEvent = {
        id: "evt-1",
        session_id: "sess-1",
        event_type: "action",
        event_data: { action_id: "check-logs" },
        created_at: "2026-03-22T10:01:00Z",
      };
      expect(event.event_type).toBe("action");
    });
  });

  describe("tutor types", () => {
    it("TutorObservation supports all tool types", () => {
      const silent: TutorObservation = {
        tool: "observe_silently",
        visible: false,
      };
      expect(silent.visible).toBe(false);
      expect(silent.content).toBeUndefined();

      const nudge: TutorObservation = {
        tool: "gentle_nudge",
        visible: true,
        content: "Have you checked the connection pool metrics?",
      };
      expect(nudge.visible).toBe(true);
      expect(nudge.content).toBeTruthy();
    });
  });

  describe("debrief types", () => {
    it("SimulationDebrief has all required sections", () => {
      const debrief: SimulationDebrief = {
        good_judgment_moments: [
          {
            action: "Checked logs first",
            why_it_was_good: "Logs revealed the root cause quickly",
            timestamp: "2026-03-22T10:02:00Z",
          },
        ],
        missed_signals: [
          {
            signal: "CPU spike on db-primary",
            what_to_check: "Database metrics dashboard",
            when_it_was_visible: "phase-1",
          },
        ],
        expert_path_comparison: {
          expert_steps: ["check-logs", "check-pool-metrics", "scale-pool"],
          trainee_steps: ["check-logs", "restart-service", "check-pool-metrics"],
          divergence_points: ["restart-service was premature"],
        },
        accountability_assessment: {
          verified: true,
          escalated_when_needed: false,
          documented_reasoning: true,
          overall: "Good diagnostic approach but delayed escalation",
        },
      };
      expect(debrief.good_judgment_moments).toHaveLength(1);
      expect(debrief.missed_signals).toHaveLength(1);
      expect(debrief.progression).toBeUndefined();
    });
  });
});
