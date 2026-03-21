/* ---- Step types (sandbox-scoped) ---- */

export type PyodideStepType = "predict" | "experiment" | "edit-and-predict" | "reflect";
// Future: export type SqlStepType = "query" | "predict" | "experiment" | "explain";
// Future: export type DiagnosticStepType = "observe" | "diagnose" | "explain" | "document";

export interface PyodideStep {
  type: PyodideStepType;
  prompt: string;
  inputPlaceholder?: string;
  /** Keywords describing what this step introduces - used to scope tutor topic matching */
  context?: string[];
}

/* ---- Shared types ---- */

export interface ExerciseMeta {
  id: string;
  title: string;
  starter_code: string;
  topics: string[];
  module_description?: string;
}

export interface RubricDimension {
  key: string;
  weight: number;
  description: string;
  label: string;
  self_assessment_description: string;
}

export interface ExerciseRubric {
  dimensions: RubricDimension[];
  pass_threshold: number;
  step_summary: string;
  scoring_guidance: Record<string, string>;
}

/* ---- Discriminated union ---- */

export interface PyodideExercise {
  content_type: "interactive-sandbox";
  sandbox: "pyodide";
  meta: ExerciseMeta;
  content: {
    intro: { welcome: string[]; context?: string[] };
    steps: PyodideStep[];
  };
  rubric: ExerciseRubric;
}

// The union - only Pyodide for now
export type ExerciseDefinition = PyodideExercise;
// Future: = PyodideExercise | SqlExercise | DiagnosticExercise | MultiOutputExercise;

/* ---- Registry ---- */

import { exercise_2_1 } from "./exercises/2.1";

const exercises: Record<string, ExerciseDefinition> = {
  "2.1": exercise_2_1,
};

/* ---- Internal accessor (not exported from package) ---- */

export function getExercise(id: string): ExerciseDefinition {
  const def = exercises[id];
  if (!def) {
    throw new Error(`Unknown exercise: ${id}`);
  }
  return def;
}

/* ---- Narrowed accessors ---- */

export function getExerciseMeta(id: string): ExerciseMeta {
  return getExercise(id).meta;
}

export function getExerciseContent(
  id: string
): ExerciseDefinition["content"] & Pick<ExerciseMeta, "title"> & { sandbox: string } {
  const ex = getExercise(id);
  return { ...ex.content, title: ex.meta.title, sandbox: ex.sandbox };
}

export function getExerciseRubric(
  id: string
): ExerciseRubric & Pick<ExerciseMeta, "id" | "title" | "starter_code"> {
  const ex = getExercise(id);
  return {
    ...ex.rubric,
    id: ex.meta.id,
    title: ex.meta.title,
    starter_code: ex.meta.starter_code,
  };
}

export function getAllExerciseIds(): string[] {
  return Object.keys(exercises);
}
