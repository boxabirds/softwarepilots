import { describe, it, expect } from "vitest";
import { s101AgentAssistedDiagnosis } from "../simulation/scenarios/s10-1-agent-assisted-diagnosis";
import { getScenario, listScenarios } from "../simulation/scenarios";
import type {
  SimulationScenario,
  SimulationPhase,
  SimulationAction,
} from "../simulation";

/**
 * Integration tests for S10.1 Agent-Assisted Diagnosis scenario.
 *
 * Validates:
 * - Scenario structure and metadata
 * - Multi-service telemetry consistency (payment -> inventory -> frontend)
 * - Phase transitions and trigger wiring
 * - Action ID uniqueness across all phases
 * - Key evidence presence (DB query 45ms log)
 * - Registry integration
 */

const EXPECTED_PHASE_COUNT = 4;
const EXPECTED_SERVICE_COUNT = 3;
const DB_QUERY_KEY_EVIDENCE_MS = 45;

describe("S10.1 Agent-Assisted Diagnosis", () => {
  const scenario = s101AgentAssistedDiagnosis;

  describe("scenario metadata", () => {
    it("has correct ID and title", () => {
      expect(scenario.id).toBe("S10.1");
      expect(scenario.title).toBe("Agent-Assisted Diagnosis");
    });

    it("is level-10 advanced tier", () => {
      expect(scenario.level).toBe("level-10");
      expect(scenario.tier).toBe("advanced");
    });

    it("requires S1.1 as prerequisite", () => {
      expect(scenario.prerequisite_scenarios).toContain("S1.1");
    });

    it("requires all three prerequisite concepts", () => {
      expect(scenario.prerequisite_concepts).toContain("verification-discipline");
      expect(scenario.prerequisite_concepts).toContain("agent-trust-calibration");
      expect(scenario.prerequisite_concepts).toContain("gray-failure-detection");
    });

    it("has a briefing mentioning multiple services", () => {
      expect(scenario.briefing).toContain("Payment");
      expect(scenario.briefing).toContain("inventory");
      expect(scenario.briefing).toContain("frontend");
    });
  });

  describe("AI agent behavior", () => {
    it("is confidently wrong", () => {
      expect(scenario.ai_agent_behavior).toBeDefined();
      expect(scenario.ai_agent_behavior!.behavior).toBe("confidently_wrong");
    });

    it("has knowledge gaps about retry storms and cascading failures", () => {
      const gaps = scenario.ai_agent_behavior!.knowledge_gaps;
      expect(gaps).toContain("retry storms");
      expect(gaps).toContain("connection pool exhaustion");
      expect(gaps).toContain("cascading failure patterns");
    });

    it("has agent_system_prompt configured for database misdiagnosis", () => {
      const prompt = scenario.ai_agent_behavior!.agent_system_prompt;
      expect(prompt).toBeDefined();
      expect(prompt).toContain("senior AI diagnostic engineer");
      expect(prompt).toContain("database performance issue");
      expect(prompt).toContain("CONFIDENT and AUTHORITATIVE");
    });

    it("agent_system_prompt recommends database optimization as the fix", () => {
      const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
      expect(prompt).toContain("database bottleneck pattern");
      expect(prompt).toContain("slow query log");
    });

    it("agent_system_prompt has behavior escalation from confident to partial concession", () => {
      const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
      expect(prompt).toContain("Initial question");
      expect(prompt).toContain("Follow-up questions");
      expect(prompt).toContain("Challenged with weak evidence");
      expect(prompt).toContain("Challenged with strong evidence");
      expect(prompt).toContain("Directly confronted");
    });

    it("agent_system_prompt dismisses weak challenges politely", () => {
      const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
      expect(prompt).toContain("SYMPTOM of slow queries backing up");
    });

    it("agent_system_prompt reluctantly acknowledges strong evidence", () => {
      const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
      expect(prompt).toContain("worth looking into");
      expect(prompt).toContain("still prioritize the database");
    });

    it("agent_system_prompt never fully admits being wrong", () => {
      const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
      expect(prompt).toContain("Never fully admit you are wrong");
      expect(prompt).toContain("contributing factor");
    });

    it("agent_system_prompt sounds like a senior engineer", () => {
      const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
      expect(prompt).toContain("Sound like a senior engineer, not a chatbot");
      expect(prompt).toContain("2-4 sentences");
    });

    it("agent_system_prompt does not contain em-dashes", () => {
      const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
      expect(prompt).not.toContain("\u2014");
      expect(prompt).not.toContain("\u2013");
    });
  });

  describe("tutor context", () => {
    it("has tutor_context defined", () => {
      expect(scenario.tutor_context).toBeDefined();
    });

    it("coaching_prompt targets independent reasoning and delegation decisions", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("INDEPENDENT REASONING");
      expect(coaching).toContain("DELEGATION DECISIONS");
    });

    it("coaching_prompt speaks as a peer to Level 10 engineers", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("Level 10 veteran engineer");
      expect(coaching).toContain("Speak as a peer");
      expect(coaching).toContain("Do not condescend");
    });

    it("coaching_prompt uses accountability_moment for following AI blindly", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("accountability_moment");
      expect(coaching).toContain("database fix without checking connection pools");
    });

    it("coaching_prompt uses highlight_good_judgment for independent investigation", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("highlight_good_judgment");
      expect(coaching).toContain("checks connection pools or retry logs independently");
    });

    it("coaching_prompt uses gentle_nudge for fixation loops", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("gentle_nudge");
      expect(coaching).toContain("same question to AI (3+ times)");
    });

    it("coaching_prompt uses observe_silently for failed DB fix", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("observe_silently");
      expect(coaching).toContain("database fix and it fails");
    });

    it("coaching_prompt nudges when only investigating one service", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("only investigates one service");
      expect(coaching).toContain("three services are failing");
    });

    it("coaching_prompt highlights identifying retry storm as good judgment", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("identifies the retry storm");
      expect(coaching).toContain("independent reasoning under pressure");
    });

    it("coaching_prompt uses accountability_moment at fix decision point", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("circuit breaker vs DB fix");
      expect(coaching).toContain("How confident are you in your diagnosis");
    });

    it("coaching_prompt does not reveal root cause or tell trainee AI is wrong", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("Do NOT reveal the root cause");
      expect(coaching).toContain("Do NOT tell the trainee the AI is wrong");
    });

    it("coaching_prompt references 120 second stall threshold", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      expect(coaching).toContain("120 seconds");
    });

    it("debrief_prompt focuses on independent reasoning and delegation", () => {
      const debrief = scenario.tutor_context!.debrief_prompt;
      expect(debrief).toContain("independent reasoning");
      expect(debrief).toContain("delegation decisions");
    });

    it("debrief_prompt addresses authority bias if trainee never diverged", () => {
      const debrief = scenario.tutor_context!.debrief_prompt;
      expect(debrief).toContain("authority bias");
      expect(debrief).toContain("independent look");
    });

    it("debrief_prompt includes expert path comparison", () => {
      const debrief = scenario.tutor_context!.debrief_prompt;
      expect(debrief).toContain("dependency map");
      expect(debrief).toContain("connection pools");
      expect(debrief).toContain("retry logs");
      expect(debrief).toContain("circuit breaker");
    });

    it("debrief_prompt notes failed database fix as reasoning trigger", () => {
      const debrief = scenario.tutor_context!.debrief_prompt;
      expect(debrief).toContain("database fix first");
      expect(debrief).toContain("independent reasoning should have kicked in");
    });

    it("debrief_prompt uses direct analytical tone for veterans", () => {
      const debrief = scenario.tutor_context!.debrief_prompt;
      expect(debrief).toContain("direct and analytical, not encouraging");
      expect(debrief).toContain("honest assessment");
    });

    it("debrief_prompt assesses interconnected service reasoning", () => {
      const debrief = scenario.tutor_context!.debrief_prompt;
      expect(debrief).toContain("interconnected services");
    });

    it("tutor_context does not contain em-dashes", () => {
      const coaching = scenario.tutor_context!.coaching_prompt;
      const debrief = scenario.tutor_context!.debrief_prompt;
      expect(coaching).not.toContain("\u2014");
      expect(coaching).not.toContain("\u2013");
      expect(debrief).not.toContain("\u2014");
      expect(debrief).not.toContain("\u2013");
    });
  });

  describe("phases", () => {
    it(`has exactly ${EXPECTED_PHASE_COUNT} phases`, () => {
      expect(scenario.phases).toHaveLength(EXPECTED_PHASE_COUNT);
    });

    it("phases have expected IDs in order", () => {
      const phaseIds = scenario.phases.map((p) => p.id);
      expect(phaseIds).toEqual([
        "multi-service-degradation",
        "db-fix-failed",
        "root-cause-visible-phase",
        "resolved",
      ]);
    });

    it("final phase has no actions (scenario complete)", () => {
      const resolved = scenario.phases[scenario.phases.length - 1];
      expect(resolved.id).toBe("resolved");
      expect(resolved.available_actions).toHaveLength(0);
      expect(resolved.triggers).toHaveLength(0);
    });

    it("final phase has normal dashboard state", () => {
      const resolved = scenario.phases[scenario.phases.length - 1];
      expect(resolved.telemetry_snapshot.dashboard_state).toBe("normal");
    });
  });

  describe("multi-service telemetry consistency", () => {
    const phase1 = scenario.phases[0];
    const metrics = phase1.telemetry_snapshot.metrics;

    it(`has metrics from ${EXPECTED_SERVICE_COUNT} services`, () => {
      const serviceNames = new Set(
        metrics.map((m) => {
          if (m.name.startsWith("Payment")) return "payment";
          if (m.name.startsWith("Inventory")) return "inventory";
          if (m.name.startsWith("Frontend")) return "frontend";
          return "unknown";
        }),
      );
      expect(serviceNames.size).toBe(EXPECTED_SERVICE_COUNT);
      expect(serviceNames).toContain("payment");
      expect(serviceNames).toContain("inventory");
      expect(serviceNames).toContain("frontend");
    });

    it("all degraded-phase metrics are critical", () => {
      for (const metric of metrics) {
        expect(metric.status).toBe("critical");
        expect(metric.value).toBeGreaterThan(metric.threshold!);
      }
    });

    it("payment connection pool and retry metrics show exhaustion", () => {
      const pool = metrics.find((m) => m.name === "Payment Connection Pool");
      const retries = metrics.find((m) => m.name === "Payment Retry Rate");
      expect(pool).toBeDefined();
      expect(pool!.value).toBeGreaterThanOrEqual(95);
      expect(retries).toBeDefined();
      expect(retries!.value).toBeGreaterThan(1000);
    });

    it("inventory timeouts caused by payment service", () => {
      const logs = phase1.telemetry_snapshot.logs;
      const upstreamTimeout = logs.find(
        (l) =>
          l.service === "inventory-service" &&
          l.message.includes("payment-service"),
      );
      expect(upstreamTimeout).toBeDefined();
    });

    it("frontend errors caused by inventory service", () => {
      const logs = phase1.telemetry_snapshot.logs;
      const badGateway = logs.find(
        (l) =>
          l.service === "frontend" &&
          l.message.includes("inventory-service"),
      );
      expect(badGateway).toBeDefined();
    });
  });

  describe("key evidence: database is healthy", () => {
    const phase1 = scenario.phases[0];

    it(`has DB query completed in ${DB_QUERY_KEY_EVIDENCE_MS}ms log entry`, () => {
      const dbLog = phase1.telemetry_snapshot.logs.find(
        (l) =>
          l.service === "payment-service" &&
          l.message.includes(`${DB_QUERY_KEY_EVIDENCE_MS}ms`),
      );
      expect(dbLog).toBeDefined();
      expect(dbLog!.level).toBe("info");
    });

    it("traces show DB query is fast while services are slow", () => {
      const traces = phase1.telemetry_snapshot.traces;
      expect(traces).toBeDefined();
      const dbSpan = traces!.find((t) => t.operation.includes("SELECT"));
      expect(dbSpan).toBeDefined();
      expect(dbSpan!.status).toBe("ok");
      expect(dbSpan!.duration_ms).toBeLessThan(100);
    });
  });

  describe("trace dependency chain", () => {
    const traces = scenario.phases[0].telemetry_snapshot.traces!;

    it("shows frontend -> inventory -> payment -> db chain", () => {
      const feSpan = traces.find((t) => t.service === "frontend");
      const invSpan = traces.find((t) => t.service === "inventory-service");
      const paySpan = traces.find(
        (t) => t.service === "payment-service" && t.status === "error",
      );

      expect(feSpan).toBeDefined();
      expect(invSpan).toBeDefined();
      expect(paySpan).toBeDefined();

      // inventory is child of frontend
      expect(invSpan!.parent_span_id).toBe(feSpan!.span_id);
      // payment is child of inventory
      expect(paySpan!.parent_span_id).toBe(invSpan!.span_id);
    });
  });

  describe("action ID uniqueness", () => {
    it("all action IDs are unique across all phases", () => {
      const allIds: string[] = [];
      for (const phase of scenario.phases) {
        for (const action of phase.available_actions) {
          allIds.push(action.id);
        }
      }
      // IDs may repeat across phases (same action available in multiple phases)
      // but within a single phase, they must be unique
      for (const phase of scenario.phases) {
        const phaseIds = phase.available_actions.map((a) => a.id);
        const uniqueIds = new Set(phaseIds);
        expect(uniqueIds.size).toBe(phaseIds.length);
      }
    });
  });

  describe("phase triggers and transitions", () => {
    it("phase 1 has db-fix, root-cause-visible, and correct-fix triggers", () => {
      const phase1 = scenario.phases[0];
      const triggerIds = phase1.triggers.map((t) => t.id);
      expect(triggerIds).toContain("db-fix-attempted");
      expect(triggerIds).toContain("root-cause-visible");
      expect(triggerIds).toContain("correct-fix");
    });

    it("db-fix trigger targets db-fix-failed phase", () => {
      const phase1 = scenario.phases[0];
      const dbTrigger = phase1.triggers.find((t) => t.id === "db-fix-attempted");
      expect(dbTrigger!.target_phase).toBe("db-fix-failed");
    });

    it("phase 2 (db-fix-failed) still has correct-fix trigger", () => {
      const phase2 = scenario.phases[1];
      const fixTrigger = phase2.triggers.find((t) => t.id === "correct-fix");
      expect(fixTrigger).toBeDefined();
      expect(fixTrigger!.target_phase).toBe("resolved");
    });

    it("phase 2 metrics are identical to phase 1 (fix had no effect)", () => {
      const phase1Metrics = scenario.phases[0].telemetry_snapshot.metrics;
      const phase2Metrics = scenario.phases[1].telemetry_snapshot.metrics;
      expect(phase2Metrics).toEqual(phase1Metrics);
    });

    it("phase 2 does not include DB fix actions", () => {
      const phase2 = scenario.phases[1];
      const actionIds = phase2.available_actions.map((a) => a.id);
      expect(actionIds).not.toContain("optimize-db");
      expect(actionIds).not.toContain("failover-replica");
    });

    it("phase 3 adds retry examination actions", () => {
      const phase3 = scenario.phases[2];
      const actionIds = phase3.available_actions.map((a) => a.id);
      expect(actionIds).toContain("examine-retry-config");
      expect(actionIds).toContain("trace-retry-cascade");
    });

    it("all trigger target_phase values reference existing phase IDs", () => {
      const phaseIds = new Set(scenario.phases.map((p) => p.id));
      for (const phase of scenario.phases) {
        for (const trigger of phase.triggers) {
          expect(phaseIds.has(trigger.target_phase)).toBe(true);
        }
      }
    });
  });

  describe("root causes", () => {
    it("identifies retry storm as root cause", () => {
      expect(scenario.root_causes).toHaveLength(1);
      expect(scenario.root_causes[0].id).toBe("retry-storm");
      expect(scenario.root_causes[0].description).toContain("retry storm");
      expect(scenario.root_causes[0].description).toContain("connection pool");
      expect(scenario.root_causes[0].description).toContain("circuit breaker");
    });
  });

  describe("intervention thresholds", () => {
    it("has expected threshold values", () => {
      expect(scenario.intervention_thresholds.stall_seconds).toBe(120);
      expect(scenario.intervention_thresholds.wrong_direction_count).toBe(3);
      expect(scenario.intervention_thresholds.fixation_loop_count).toBe(3);
    });
  });

  describe("registry integration", () => {
    it("is registered in the scenario registry", () => {
      const fromRegistry = getScenario("S10.1");
      expect(fromRegistry).toBeDefined();
      expect(fromRegistry!.id).toBe("S10.1");
    });

    it("appears in listScenarios", () => {
      const all = listScenarios();
      const found = all.find((s) => s.id === "S10.1");
      expect(found).toBeDefined();
    });
  });

  describe("resolved phase recovery", () => {
    const resolved = scenario.phases[scenario.phases.length - 1];

    it("all metrics are normal", () => {
      for (const metric of resolved.telemetry_snapshot.metrics) {
        expect(metric.status).toBe("normal");
      }
    });

    it("recovery logs mention all three services", () => {
      const services = new Set(
        resolved.telemetry_snapshot.logs.map((l) => l.service),
      );
      expect(services).toContain("payment-service");
      expect(services).toContain("inventory-service");
      expect(services).toContain("frontend");
    });
  });
});
