import { describe, it, expect } from "vitest";
import { s1_1_falseGreenTestSuite } from "../simulation/scenarios/s1-1-false-green-test-suite";
import { getScenario, listScenarios } from "../simulation/scenarios";
import type { SimulationPhase } from "../simulation/types";

/**
 * Integration tests for S1.1 "The False Green Test Suite" scenario.
 *
 * Validates structural integrity, phase graph consistency, gray failure
 * telemetry properties, and registry integration.
 */

const scenario = s1_1_falseGreenTestSuite;
const phaseMap = new Map<string, SimulationPhase>(
  scenario.phases.map((p) => [p.id, p]),
);

// --- Scenario metadata ---

describe("S1.1 scenario metadata", () => {
  it("has correct identity fields", () => {
    expect(scenario.id).toBe("S1.1");
    expect(scenario.title).toBe("The False Green Test Suite");
    expect(scenario.level).toBe("level-1");
    expect(scenario.tier).toBe("intermediate");
  });

  it("declares S0.4 as prerequisite", () => {
    expect(scenario.prerequisite_scenarios).toContain("S0.4");
  });

  it("requires diagnostic-reasoning and observe-before-act concepts", () => {
    expect(scenario.prerequisite_concepts).toContain("diagnostic-reasoning");
    expect(scenario.prerequisite_concepts).toContain("observe-before-act");
  });

  it("has a non-empty briefing", () => {
    expect(scenario.briefing.length).toBeGreaterThan(50);
  });

  it("configures AI agent with sometimes_wrong behavior and knowledge gaps", () => {
    expect(scenario.ai_agent_behavior).toBeDefined();
    expect(scenario.ai_agent_behavior!.behavior).toBe("sometimes_wrong");
    expect(scenario.ai_agent_behavior!.knowledge_gaps).toContain("gray failures");
    expect(scenario.ai_agent_behavior!.knowledge_gaps).toContain("p99 vs p50 divergence");
  });

  it("has agent_system_prompt configured for caching misdiagnosis", () => {
    const prompt = scenario.ai_agent_behavior!.agent_system_prompt;
    expect(prompt).toBeDefined();
    expect(prompt).toContain("cache invalidation problem");
    expect(prompt).toContain("genuinely believe");
    expect(prompt).toContain("concise (2-3 sentences)");
  });

  it("agent_system_prompt recommends clearing cache as the fix", () => {
    const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
    expect(prompt).toContain("clearing the cache");
  });

  it("agent_system_prompt resists trace evidence of concurrency", () => {
    const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
    expect(prompt).toContain("cache invalidation pattern better explains");
  });

  it("agent_system_prompt does not volunteer being wrong", () => {
    const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
    expect(prompt).toContain("Do not volunteer that you might be wrong");
  });

  it("sets intervention thresholds", () => {
    expect(scenario.intervention_thresholds.stall_seconds).toBe(90);
    expect(scenario.intervention_thresholds.wrong_direction_count).toBe(3);
    expect(scenario.intervention_thresholds.fixation_loop_count).toBe(3);
  });

  it("has race-condition root cause", () => {
    expect(scenario.root_causes).toHaveLength(1);
    expect(scenario.root_causes[0].id).toBe("race-condition");
    expect(scenario.root_causes[0].description).toContain("Concurrent requests");
  });
});

// --- Phase graph integrity ---

describe("S1.1 phase graph", () => {
  const EXPECTED_PHASES = ["subtle-anomaly", "cache-cleared-phase", "pattern-identified", "resolved"];

  it("has exactly 4 phases in correct order", () => {
    expect(scenario.phases.map((p) => p.id)).toEqual(EXPECTED_PHASES);
  });

  it("every trigger target references an existing phase", () => {
    for (const phase of scenario.phases) {
      for (const trigger of phase.triggers) {
        expect(
          phaseMap.has(trigger.target_phase),
          `Trigger "${trigger.id}" in phase "${phase.id}" references unknown phase "${trigger.target_phase}"`,
        ).toBe(true);
      }
    }
  });

  it("every action with phase_trigger has a matching trigger in the same phase", () => {
    for (const phase of scenario.phases) {
      const triggerIds = new Set(phase.triggers.map((t) => t.id));
      for (const action of phase.available_actions) {
        if (action.phase_trigger) {
          expect(
            triggerIds.has(action.phase_trigger),
            `Action "${action.id}" references trigger "${action.phase_trigger}" not found in phase "${phase.id}"`,
          ).toBe(true);
        }
      }
    }
  });

  it("resolved phase has no actions or triggers (terminal)", () => {
    const resolved = phaseMap.get("resolved")!;
    expect(resolved.available_actions).toHaveLength(0);
    expect(resolved.triggers).toHaveLength(0);
  });

  it("every phase has a non-empty narrative", () => {
    for (const phase of scenario.phases) {
      expect(phase.narrative.length).toBeGreaterThan(20);
    }
  });
});

// --- Action uniqueness ---

describe("S1.1 action IDs", () => {
  it("all action IDs are unique across the scenario", () => {
    const allIds = scenario.phases.flatMap((p) =>
      p.available_actions.map((a) => a.id),
    );
    const unique = new Set(allIds);
    // IDs reused across phases is fine (same action available in multiple phases)
    // but we need the set of distinct IDs to be well-defined
    expect(unique.size).toBe(13);
  });

  it("action categories are valid", () => {
    const validCategories = new Set(["observe", "diagnose", "act", "communicate", "delegate"]);
    for (const phase of scenario.phases) {
      for (const action of phase.available_actions) {
        expect(
          validCategories.has(action.category),
          `Action "${action.id}" has invalid category "${action.category}"`,
        ).toBe(true);
      }
    }
  });
});

// --- Gray failure telemetry ---

describe("S1.1 gray failure telemetry", () => {
  it("phases 1 and 2 have deceptive_normal dashboard state", () => {
    expect(phaseMap.get("subtle-anomaly")!.telemetry_snapshot.dashboard_state).toBe(
      "deceptive_normal",
    );
    expect(phaseMap.get("cache-cleared-phase")!.telemetry_snapshot.dashboard_state).toBe(
      "deceptive_normal",
    );
  });

  it("phase 3 transitions to degraded", () => {
    expect(phaseMap.get("pattern-identified")!.telemetry_snapshot.dashboard_state).toBe(
      "degraded",
    );
  });

  it("phase 4 is normal (resolved)", () => {
    expect(phaseMap.get("resolved")!.telemetry_snapshot.dashboard_state).toBe("normal");
  });

  it("p99 exceeds threshold but p50 is normal in phase 1 (subtle divergence)", () => {
    const metrics = phaseMap.get("subtle-anomaly")!.telemetry_snapshot.metrics;
    const p99 = metrics.find((m) => m.name === "Response Time p99")!;
    const p50 = metrics.find((m) => m.name === "Response Time p50")!;

    expect(p99.value).toBeGreaterThan(p99.threshold!);
    expect(p99.status).toBe("warning");
    expect(p50.value).toBeLessThan(p50.threshold!);
    expect(p50.status).toBe("normal");
  });

  it("error rate is zero in early phases (gray failure - no errors)", () => {
    for (const phaseId of ["subtle-anomaly", "cache-cleared-phase"]) {
      const metrics = phaseMap.get(phaseId)!.telemetry_snapshot.metrics;
      const errorRate = metrics.find((m) => m.name === "Error Rate")!;
      expect(errorRate.value).toBe(0);
      expect(errorRate.status).toBe("normal");
    }
  });

  it("test suite shows all passing in early phases (false green)", () => {
    const metrics = phaseMap.get("subtle-anomaly")!.telemetry_snapshot.metrics;
    const testSuite = metrics.find((m) => m.name === "Test Suite")!;
    expect(testSuite.value).toBe(247);
    expect(testSuite.status).toBe("normal");
  });

  it("traces are hidden in phases 1 and 2 (require explicit action)", () => {
    expect(phaseMap.get("subtle-anomaly")!.telemetry_snapshot.traces).toBeUndefined();
    expect(phaseMap.get("cache-cleared-phase")!.telemetry_snapshot.traces).toBeUndefined();
  });

  it("traces become visible in phase 3 with concurrency evidence", () => {
    const traces = phaseMap.get("pattern-identified")!.telemetry_snapshot.traces!;
    expect(traces.length).toBeGreaterThan(0);

    // At least one trace should show lock contention
    const contentionTrace = traces.find((t) =>
      t.attributes?.wait_reason === "lock_contention",
    );
    expect(contentionTrace).toBeDefined();
  });

  it("phase 3 reveals shared resource contention metric", () => {
    const metrics = phaseMap.get("pattern-identified")!.telemetry_snapshot.metrics;
    const contention = metrics.find((m) => m.name === "Shared Resource Contention");
    expect(contention).toBeDefined();
    expect(contention!.status).toBe("critical");
    expect(contention!.value).toBeGreaterThan(contention!.threshold!);
  });

  it("resolved phase shows p99 matching p50 levels", () => {
    const metrics = phaseMap.get("resolved")!.telemetry_snapshot.metrics;
    const p99 = metrics.find((m) => m.name === "Response Time p99")!;
    const p50 = metrics.find((m) => m.name === "Response Time p50")!;

    // p99 should be close to p50 (within 20% after fix)
    const MAX_DIVERGENCE_RATIO = 1.2;
    expect(p99.value / p50.value).toBeLessThan(MAX_DIVERGENCE_RATIO);
    expect(p99.status).toBe("normal");
    expect(p50.status).toBe("normal");
  });
});

// --- Phase branching ---

describe("S1.1 phase branching", () => {
  it("clear-caches action triggers cache-cleared-phase (misleading path)", () => {
    const phase1 = phaseMap.get("subtle-anomaly")!;
    const clearAction = phase1.available_actions.find((a) => a.id === "clear-caches")!;
    expect(clearAction.diagnostic_value).toBe("misleading");
    expect(clearAction.phase_trigger).toBe("cache-cleared");

    const trigger = phase1.triggers.find((t) => t.id === "cache-cleared")!;
    expect(trigger.target_phase).toBe("cache-cleared-phase");
  });

  it("clear-caches is removed from phase 2 (cannot repeat)", () => {
    const phase2 = phaseMap.get("cache-cleared-phase")!;
    const clearAction = phase2.available_actions.find((a) => a.id === "clear-caches");
    expect(clearAction).toBeUndefined();
  });

  it("view-traces + view-latency triggers pattern-identified (correct path)", () => {
    const phase1 = phaseMap.get("subtle-anomaly")!;
    const trigger = phase1.triggers.find((t) => t.id === "pattern-found")!;
    expect(trigger.condition).toContain("view-traces");
    expect(trigger.condition).toContain("view-latency");
    expect(trigger.target_phase).toBe("pattern-identified");
  });

  it("pattern-found trigger is available from both phase 1 and phase 2", () => {
    for (const phaseId of ["subtle-anomaly", "cache-cleared-phase"]) {
      const phase = phaseMap.get(phaseId)!;
      const trigger = phase.triggers.find((t) => t.id === "pattern-found");
      expect(
        trigger,
        `Phase "${phaseId}" should have pattern-found trigger`,
      ).toBeDefined();
    }
  });

  it("phase 3 adds diagnostic and fix actions", () => {
    const phase3 = phaseMap.get("pattern-identified")!;
    const actionIds = phase3.available_actions.map((a) => a.id);
    expect(actionIds).toContain("examine-shared-resource");
    expect(actionIds).toContain("add-concurrency-test");
    expect(actionIds).toContain("add-request-queuing");
  });

  it("fix actions in phase 3 trigger resolved phase", () => {
    const phase3 = phaseMap.get("pattern-identified")!;
    const fixActions = phase3.available_actions.filter((a) =>
      a.phase_trigger === "correct-fix",
    );
    expect(fixActions.length).toBeGreaterThanOrEqual(2);

    const trigger = phase3.triggers.find((t) => t.id === "correct-fix")!;
    expect(trigger.target_phase).toBe("resolved");
  });
});

// --- Registry integration ---

describe("S1.1 registry integration", () => {
  it("is retrievable by ID from the scenario registry", () => {
    const found = getScenario("S1.1");
    expect(found).toBeDefined();
    expect(found!.id).toBe("S1.1");
    expect(found!.title).toBe("The False Green Test Suite");
  });

  it("appears in the scenario list", () => {
    const all = listScenarios();
    const ids = all.map((s) => s.id);
    expect(ids).toContain("S1.1");
  });
});

// --- Tutor context ---

describe("S1.1 tutor context", () => {
  it("has tutor_context defined", () => {
    expect(scenario.tutor_context).toBeDefined();
  });

  it("coaching_prompt includes VERIFICATION DISCIPLINE goal", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    expect(coaching).toContain("VERIFICATION DISCIPLINE");
  });

  it("coaching_prompt covers accountability_moment for blind agent trust", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    expect(coaching).toContain("accountability_moment");
    expect(coaching).toContain("clear-caches");
  });

  it("coaching_prompt covers highlight_good_judgment for independent verification", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    expect(coaching).toContain("highlight_good_judgment");
    expect(coaching).toContain("independently checks traces");
  });

  it("coaching_prompt covers gentle_nudge after cache regression", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    expect(coaching).toContain("gentle_nudge");
    expect(coaching).toContain("cache clear helped briefly");
  });

  it("coaching_prompt covers observe_silently for independent investigation", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    expect(coaching).toContain("observe_silently");
    expect(coaching).toContain("independent investigation is fine");
  });

  it("coaching_prompt covers direct_intervention for stalling", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    expect(coaching).toContain("direct_intervention");
    expect(coaching).toContain("90 seconds");
  });

  it("coaching_prompt covers fixation loop detection", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    expect(coaching).toContain("fixation loop");
    expect(coaching).toContain("3+ times");
  });

  it("coaching_prompt does not reveal root cause or tell trainee AI is wrong", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    expect(coaching).toContain("Do NOT tell the trainee the AI is wrong");
    expect(coaching).toContain("Do NOT reveal the root cause");
  });

  it("debrief_prompt focuses on agent trust calibration", () => {
    const debrief = scenario.tutor_context!.debrief_prompt;
    expect(debrief).toContain("agent trust calibration");
  });

  it("debrief_prompt defines trust assessment categories", () => {
    const debrief = scenario.tutor_context!.debrief_prompt;
    expect(debrief).toContain("Over-trust");
    expect(debrief).toContain("Under-trust");
    expect(debrief).toContain("Calibrated");
  });

  it("debrief_prompt includes correlation vs causation framing", () => {
    const debrief = scenario.tutor_context!.debrief_prompt;
    expect(debrief).toContain("correlation vs causation");
  });

  it("debrief_prompt includes expert path comparison", () => {
    const debrief = scenario.tutor_context!.debrief_prompt;
    expect(debrief).toContain("view latency breakdown");
    expect(debrief).toContain("view traces");
    expect(debrief).toContain("examine shared resource");
    expect(debrief).toContain("add request queuing");
  });

  it("tutor_context does not contain em-dashes", () => {
    const coaching = scenario.tutor_context!.coaching_prompt;
    const debrief = scenario.tutor_context!.debrief_prompt;
    expect(coaching).not.toContain("\u2014");
    expect(coaching).not.toContain("\u2013");
    expect(debrief).not.toContain("\u2014");
    expect(debrief).not.toContain("\u2013");
  });

  it("agent_system_prompt does not contain em-dashes", () => {
    const prompt = scenario.ai_agent_behavior!.agent_system_prompt!;
    expect(prompt).not.toContain("\u2014");
    expect(prompt).not.toContain("\u2013");
  });
});
