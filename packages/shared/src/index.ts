export {
  getExerciseMeta,
  getExerciseContent,
  getExerciseRubric,
  getAllExerciseIds,
} from "./exercises";

export type {
  ExerciseDefinition,
  ExerciseMeta,
  ExerciseRubric,
  RubricDimension,
  PyodideStep,
  PyodideStepType,
} from "./exercises";

export {
  getCurriculumProfiles,
  getCurriculumMeta,
  getCurriculumSections,
  getSection,
  extractConcepts,
  learningMapRegistry,
  getLearningMap,
  getLearningMapForProfile,
} from "./curricula";

export type {
  LearnerProfile,
  AccountabilityScope,
  CurriculumMeta,
  CurriculumData,
  SectionMeta,
  CurriculumProfileSummary,
  SectionLearningMap,
  Claim,
  Misconception,
  SubInsight,
} from "./curricula";

export type {
  MetricDataPoint,
  LogEntry,
  TraceSpan,
  TelemetrySnapshot,
  SimulationAction,
  PhaseTrigger,
  SimulationPhase,
  RootCause,
  InterventionThresholds,
  AIAgentConfig,
  SimulationScenario,
  SimulationSession,
  SimulationEvent,
  TutorObservation,
  SimulationDebrief,
} from "./simulation";

export {
  scenarioRegistry,
  getScenarioFromRegistry,
  listScenarios,
  s04FirstSoloDiagnosis,
  s1_1_falseGreenTestSuite,
  s101AgentAssistedDiagnosis,
} from "./simulation";

export { validateLearningMap } from "./curricula/learning-map-validator";
export type { ValidationResult } from "./curricula/learning-map-validator";
