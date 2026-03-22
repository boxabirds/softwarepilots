import type { SimulationScenario } from "../types";
import { s04FirstSoloDiagnosis } from "./s0-4-first-solo-diagnosis";
import { s1_1_falseGreenTestSuite } from "./s1-1-false-green-test-suite";
import { s101AgentAssistedDiagnosis } from "./s10-1-agent-assisted-diagnosis";

export const scenarioRegistry: ReadonlyMap<string, SimulationScenario> = new Map([
  [s04FirstSoloDiagnosis.id, s04FirstSoloDiagnosis],
  [s1_1_falseGreenTestSuite.id, s1_1_falseGreenTestSuite],
  [s101AgentAssistedDiagnosis.id, s101AgentAssistedDiagnosis],
]);

export function getScenario(id: string): SimulationScenario | undefined {
  return scenarioRegistry.get(id);
}

export function listScenarios(): SimulationScenario[] {
  return Array.from(scenarioRegistry.values());
}

export { s04FirstSoloDiagnosis, s1_1_falseGreenTestSuite, s101AgentAssistedDiagnosis };
