/* ---- Step rendering derivation ---- */
/* Derives all presentation behavior from semantic step types. */
/* No per-exercise authoring - step type alone determines rendering. */

import type { PyodideStepType } from "@softwarepilots/shared";

export type InputType = "prediction" | "reflection";

export interface StepRendering {
  /** Which element receives focus when the step activates */
  focus: "editor" | "input";
  /** Whether the step includes a Run action */
  showRun: boolean;
  /** Whether the step collects text input from the learner */
  hasInput: boolean;
  /** Semantic role of the input, if any */
  inputType: InputType | null;
  /** Whether text input must be submitted before Run is enabled */
  inputGatesRun: boolean;
  /** Whether the learner must explicitly acknowledge output before advancing */
  requiresAcknowledgment: boolean;
}

/**
 * Static lookup - every Pyodide step type maps to exactly one rendering config.
 *
 * predict:          Learner types a prediction → runs code → sees comparison
 * experiment:       Learner edits code → runs it (no text input)
 * edit-and-predict: Learner edits code → types prediction → runs → sees comparison
 * reflect:          Learner types a reflection (no run)
 */
const PYODIDE_RENDERING: Record<PyodideStepType, StepRendering> = {
  predict: {
    focus: "input",
    showRun: true,
    hasInput: true,
    inputType: "prediction",
    inputGatesRun: true,
    requiresAcknowledgment: false,
  },
  experiment: {
    focus: "editor",
    showRun: true,
    hasInput: false,
    inputType: null,
    inputGatesRun: false,
    requiresAcknowledgment: true,
  },
  "edit-and-predict": {
    focus: "editor",
    showRun: true,
    hasInput: true,
    inputType: "prediction",
    inputGatesRun: true,
    requiresAcknowledgment: false,
  },
  reflect: {
    focus: "input",
    showRun: false,
    hasInput: true,
    inputType: "reflection",
    inputGatesRun: false,
    requiresAcknowledgment: false,
  },
};

export function getStepRendering(stepType: PyodideStepType): StepRendering {
  return PYODIDE_RENDERING[stepType];
}
