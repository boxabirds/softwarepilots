import { describe, it, expect } from "vitest";
import { s04FirstSoloDiagnosis } from "../simulation/scenarios/s0-4-first-solo-diagnosis";
import { getScenario, listScenarios } from "../simulation/scenarios";
import type {
  SimulationScenario,
  SimulationPhase,
  SimulationAction,
} from "../simulation/types";

/* ---- Constants for assertions ---- */

const EXPECTED_PHASE_COUNT = 4;
const EXPECTED_ROOT_CAUSE_COUNT = 1;
const EXPECTED_STALL_SECONDS = 60;
const EXPECTED_WRONG_DIRECTION_COUNT = 2;
const EXPECTED_FIXATION_LOOP_COUNT = 3;

const PHASE_IDS = [
  "alert-received",
  "root-cause-identified",
  "service-restarted",
  "resolved",
];

/* ---- Scenario structure tests ---- */

describe("S0.4 First Solo Diagnosis", () => {
  const scenario: SimulationScenario = s04FirstSoloDiagnosis;

  describe("top-level properties", () => {
    it("has correct id and title", () => {
      expect(scenario.id).toBe("S0.4");
      expect(scenario.title).toBe("First Solo Diagnosis");
    });

    it("targets level-0 introductory tier", () => {
      expect(scenario.level).toBe("level-0");
      expect(scenario.tier).toBe("introductory");
    });

    it("has no prerequisites for level-0", () => {
      expect(scenario.prerequisite_scenarios).toEqual([]);
      expect(scenario.prerequisite_concepts).toEqual([]);
    });

    it("has a non-empty briefing", () => {
      expect(scenario.briefing.length).toBeGreaterThan(0);
      expect(scenario.briefing).toContain("on call");
    });

    it("has no AI agent (level-0 is solo)", () => {
      expect(scenario.ai_agent_behavior).toBeUndefined();
    });
  });

  describe("phases", () => {
    it("has exactly 4 phases", () => {
      expect(scenario.phases).toHaveLength(EXPECTED_PHASE_COUNT);
    });

    it("phases are in the correct order", () => {
      const ids = scenario.phases.map((p) => p.id);
      expect(ids).toEqual(PHASE_IDS);
    });

    it("all phase IDs are unique", () => {
      const ids = scenario.phases.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("all phases have non-empty narratives", () => {
      for (const phase of scenario.phases) {
        expect(phase.narrative.length).toBeGreaterThan(0);
      }
    });
  });

  describe("actions", () => {
    it("all action IDs are unique within each phase", () => {
      for (const phase of scenario.phases) {
        const phaseActionIds = new Set<string>();
        for (const action of phase.available_actions) {
          expect(phaseActionIds.has(action.id)).toBe(false);
          phaseActionIds.add(action.id);
        }
      }
    });

    it("every action has a valid category", () => {
      const validCategories = new Set([
        "observe",
        "diagnose",
        "act",
        "communicate",
        "delegate",
      ]);
      for (const phase of scenario.phases) {
        for (const action of phase.available_actions) {
          expect(validCategories.has(action.category)).toBe(true);
        }
      }
    });

    it("every action has a valid diagnostic_value", () => {
      const validValues = new Set(["high", "medium", "low", "misleading"]);
      for (const phase of scenario.phases) {
        for (const action of phase.available_actions) {
          expect(validValues.has(action.diagnostic_value)).toBe(true);
        }
      }
    });

    it("phase_trigger references match actual trigger IDs", () => {
      const allTriggerIds = new Set<string>();
      for (const phase of scenario.phases) {
        for (const trigger of phase.triggers) {
          allTriggerIds.add(trigger.id);
        }
      }

      for (const phase of scenario.phases) {
        for (const action of phase.available_actions) {
          if (action.phase_trigger) {
            expect(allTriggerIds.has(action.phase_trigger)).toBe(true);
          }
        }
      }
    });
  });

  describe("phase 1 - alert-received", () => {
    let phase: SimulationPhase;

    it("is the initial phase", () => {
      phase = scenario.phases[0];
      expect(phase.id).toBe("alert-received");
    });

    it("dashboard is in alarm state", () => {
      expect(phase.telemetry_snapshot.dashboard_state).toBe("alarm");
    });

    it("has critical HTTP 500 error rate", () => {
      const errorMetric = phase.telemetry_snapshot.metrics.find(
        (m) => m.name === "HTTP 500 Error Rate"
      );
      expect(errorMetric).toBeDefined();
      expect(errorMetric!.status).toBe("critical");
      expect(errorMetric!.value).toBeGreaterThan(errorMetric!.threshold!);
    });

    it("has critical memory usage", () => {
      const memMetric = phase.telemetry_snapshot.metrics.find(
        (m) => m.name === "Memory Usage"
      );
      expect(memMetric).toBeDefined();
      expect(memMetric!.status).toBe("critical");
    });

    it("has normal CPU usage (not everything is broken)", () => {
      const cpuMetric = phase.telemetry_snapshot.metrics.find(
        (m) => m.name === "CPU Usage"
      );
      expect(cpuMetric).toBeDefined();
      expect(cpuMetric!.status).toBe("normal");
    });

    it("has observation actions available", () => {
      const observeActions = phase.available_actions.filter(
        (a) => a.category === "observe"
      );
      expect(observeActions.length).toBeGreaterThanOrEqual(2);
    });

    it("restart-service triggers premature restart path", () => {
      const restart = phase.available_actions.find(
        (a) => a.id === "restart-service"
      );
      expect(restart).toBeDefined();
      expect(restart!.phase_trigger).toBe("restart-without-diagnosis");
    });

    it("has triggers for both investigation and premature restart", () => {
      expect(phase.triggers).toHaveLength(2);
      const targetPhases = phase.triggers.map((t) => t.target_phase);
      expect(targetPhases).toContain("root-cause-identified");
      expect(targetPhases).toContain("service-restarted");
    });

    it("logs include OOM error and deployment info", () => {
      const logs = phase.telemetry_snapshot.logs;
      const hasOOM = logs.some((l) =>
        l.message.includes("OutOfMemoryError")
      );
      const hasDeployment = logs.some((l) =>
        l.message.includes("Deployment")
      );
      expect(hasOOM).toBe(true);
      expect(hasDeployment).toBe(true);
    });

    it("log timestamps tell a chronological story", () => {
      const logs = phase.telemetry_snapshot.logs;
      const timestamps = logs.map((l) => new Date(l.timestamp).getTime());
      // Deployment should be the earliest log
      const deployLog = logs.find((l) => l.message.includes("Deployment"));
      const errorLogs = logs.filter((l) => l.level === "error");
      expect(
        new Date(deployLog!.timestamp).getTime()
      ).toBeLessThan(
        new Date(errorLogs[0].timestamp).getTime()
      );
    });
  });

  describe("phase 2 - root-cause-identified", () => {
    let phase: SimulationPhase;

    it("adds remediation actions", () => {
      phase = scenario.phases.find((p) => p.id === "root-cause-identified")!;
      const rollback = phase.available_actions.find(
        (a) => a.id === "rollback-deployment"
      );
      const increaseMemory = phase.available_actions.find(
        (a) => a.id === "increase-memory"
      );
      expect(rollback).toBeDefined();
      expect(increaseMemory).toBeDefined();
    });

    it("rollback has high diagnostic value", () => {
      phase = scenario.phases.find((p) => p.id === "root-cause-identified")!;
      const rollback = phase.available_actions.find(
        (a) => a.id === "rollback-deployment"
      );
      expect(rollback!.diagnostic_value).toBe("high");
    });

    it("both fix actions trigger resolution", () => {
      phase = scenario.phases.find((p) => p.id === "root-cause-identified")!;
      const rollback = phase.available_actions.find(
        (a) => a.id === "rollback-deployment"
      );
      const increaseMemory = phase.available_actions.find(
        (a) => a.id === "increase-memory"
      );
      expect(rollback!.phase_trigger).toBe("correct-fix");
      expect(increaseMemory!.phase_trigger).toBe("correct-fix");
    });

    it("has additional logs showing OOM correlation with deployment", () => {
      phase = scenario.phases.find((p) => p.id === "root-cause-identified")!;
      const logs = phase.telemetry_snapshot.logs;
      expect(logs.length).toBeGreaterThan(
        scenario.phases[0].telemetry_snapshot.logs.length
      );
    });
  });

  describe("phase 3 - service-restarted", () => {
    let phase: SimulationPhase;

    it("does not include restart-service action (already tried)", () => {
      phase = scenario.phases.find((p) => p.id === "service-restarted")!;
      const restart = phase.available_actions.find(
        (a) => a.id === "restart-service"
      );
      expect(restart).toBeUndefined();
    });

    it("dashboard returns to alarm after brief recovery", () => {
      phase = scenario.phases.find((p) => p.id === "service-restarted")!;
      expect(phase.telemetry_snapshot.dashboard_state).toBe("alarm");
    });

    it("allows return to investigation path", () => {
      phase = scenario.phases.find((p) => p.id === "service-restarted")!;
      const trigger = phase.triggers.find(
        (t) => t.target_phase === "root-cause-identified"
      );
      expect(trigger).toBeDefined();
    });
  });

  describe("phase 4 - resolved", () => {
    let phase: SimulationPhase;

    it("dashboard is normal", () => {
      phase = scenario.phases.find((p) => p.id === "resolved")!;
      expect(phase.telemetry_snapshot.dashboard_state).toBe("normal");
    });

    it("all metrics are normal", () => {
      phase = scenario.phases.find((p) => p.id === "resolved")!;
      for (const metric of phase.telemetry_snapshot.metrics) {
        expect(metric.status).toBe("normal");
      }
    });

    it("has no available actions (scenario complete)", () => {
      phase = scenario.phases.find((p) => p.id === "resolved")!;
      expect(phase.available_actions).toHaveLength(0);
    });

    it("has no triggers", () => {
      phase = scenario.phases.find((p) => p.id === "resolved")!;
      expect(phase.triggers).toHaveLength(0);
    });

    it("logs show recovery", () => {
      phase = scenario.phases.find((p) => p.id === "resolved")!;
      const hasRecovery = phase.telemetry_snapshot.logs.some((l) =>
        l.message.toLowerCase().includes("recover")
      );
      expect(hasRecovery).toBe(true);
    });
  });

  describe("root causes", () => {
    it("has exactly one root cause", () => {
      expect(scenario.root_causes).toHaveLength(EXPECTED_ROOT_CAUSE_COUNT);
    });

    it("root cause describes OOM from deployment", () => {
      const rc = scenario.root_causes[0];
      expect(rc.id).toBe("oom-from-deploy");
      expect(rc.description).toContain("memory leak");
      expect(rc.description).toContain("OutOfMemoryError");
    });
  });

  describe("intervention thresholds", () => {
    it("has correct stall threshold", () => {
      expect(scenario.intervention_thresholds.stall_seconds).toBe(
        EXPECTED_STALL_SECONDS
      );
    });

    it("has correct wrong direction count", () => {
      expect(scenario.intervention_thresholds.wrong_direction_count).toBe(
        EXPECTED_WRONG_DIRECTION_COUNT
      );
    });

    it("has correct fixation loop count", () => {
      expect(scenario.intervention_thresholds.fixation_loop_count).toBe(
        EXPECTED_FIXATION_LOOP_COUNT
      );
    });
  });
});

describe("scenario registry", () => {
  it("S0.4 is registered in the scenario registry", () => {
    const scenario = getScenario("S0.4");
    expect(scenario).toBeDefined();
    expect(scenario!.id).toBe("S0.4");
  });

  it("listScenarios includes S0.4", () => {
    const all = listScenarios();
    const s04 = all.find((s) => s.id === "S0.4");
    expect(s04).toBeDefined();
  });

  it("returns undefined for non-existent scenario", () => {
    expect(getScenario("NONEXISTENT")).toBeUndefined();
  });
});
