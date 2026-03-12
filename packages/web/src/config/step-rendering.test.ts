import { describe, it, expect } from "vitest";
import { getStepRendering, type StepRendering } from "./step-rendering";
import type { PyodideStepType } from "@softwarepilots/shared";

const ALL_STEP_TYPES: PyodideStepType[] = [
  "predict",
  "experiment",
  "edit-and-predict",
  "reflect",
];

describe("getStepRendering", () => {
  it("returns a rendering for every Pyodide step type", () => {
    for (const type of ALL_STEP_TYPES) {
      const rendering = getStepRendering(type);
      expect(rendering).toBeDefined();
      expect(rendering.focus).toMatch(/^(editor|input)$/);
      expect(typeof rendering.showRun).toBe("boolean");
      expect(typeof rendering.hasInput).toBe("boolean");
      expect(typeof rendering.inputGatesRun).toBe("boolean");
      expect(typeof rendering.requiresAcknowledgment).toBe("boolean");
    }
  });

  describe("predict", () => {
    let r: StepRendering;
    r = getStepRendering("predict");

    it("focuses input (learner types prediction first)", () => {
      expect(r.focus).toBe("input");
    });

    it("shows run (learner runs after predicting)", () => {
      expect(r.showRun).toBe(true);
    });

    it("has prediction input that gates run", () => {
      expect(r.hasInput).toBe(true);
      expect(r.inputType).toBe("prediction");
      expect(r.inputGatesRun).toBe(true);
    });
  });

  describe("experiment", () => {
    let r: StepRendering;
    r = getStepRendering("experiment");

    it("focuses editor (learner edits code)", () => {
      expect(r.focus).toBe("editor");
    });

    it("shows run", () => {
      expect(r.showRun).toBe(true);
    });

    it("has no text input", () => {
      expect(r.hasInput).toBe(false);
      expect(r.inputType).toBeNull();
      expect(r.inputGatesRun).toBe(false);
    });

    it("requires acknowledgment before advancing", () => {
      expect(r.requiresAcknowledgment).toBe(true);
    });
  });

  describe("edit-and-predict", () => {
    let r: StepRendering;
    r = getStepRendering("edit-and-predict");

    it("focuses editor (learner edits first, then predicts)", () => {
      expect(r.focus).toBe("editor");
    });

    it("shows run", () => {
      expect(r.showRun).toBe(true);
    });

    it("has prediction input that gates run", () => {
      expect(r.hasInput).toBe(true);
      expect(r.inputType).toBe("prediction");
      expect(r.inputGatesRun).toBe(true);
    });
  });

  describe("reflect", () => {
    let r: StepRendering;
    r = getStepRendering("reflect");

    it("focuses input (learner writes reflection)", () => {
      expect(r.focus).toBe("input");
    });

    it("does not show run", () => {
      expect(r.showRun).toBe(false);
    });

    it("has reflection input that does not gate run", () => {
      expect(r.hasInput).toBe(true);
      expect(r.inputType).toBe("reflection");
      expect(r.inputGatesRun).toBe(false);
    });
  });

  it("only experiment step requires acknowledgment", () => {
    for (const type of ALL_STEP_TYPES) {
      const r = getStepRendering(type);
      if (type === "experiment") {
        expect(r.requiresAcknowledgment).toBe(true);
      } else {
        expect(r.requiresAcknowledgment).toBe(false);
      }
    }
  });

  it("inputGatesRun is only true when both hasInput and showRun are true", () => {
    for (const type of ALL_STEP_TYPES) {
      const r = getStepRendering(type);
      if (r.inputGatesRun) {
        expect(r.hasInput).toBe(true);
        expect(r.showRun).toBe(true);
      }
    }
  });
});
