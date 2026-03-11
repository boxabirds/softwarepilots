import { describe, it, expect, beforeAll } from "vitest";
import {
  getExercise,
  getExerciseMeta,
  getExerciseContent,
  getExerciseRubric,
  getAllExerciseIds,
} from "./exercises";
import type { ExerciseDefinition } from "./exercises";

describe("getExercise", () => {
  it("throws on unknown exercise ID", () => {
    expect(() => getExercise("unknown")).toThrow("Unknown exercise: unknown");
  });

  it("returns a definition for 2.1", () => {
    const ex = getExercise("2.1");
    expect(ex).toBeDefined();
    expect(ex.meta.id).toBe("2.1");
  });
});

describe("getAllExerciseIds", () => {
  it("includes 2.1", () => {
    expect(getAllExerciseIds()).toContain("2.1");
  });
});

describe("getExerciseMeta", () => {
  it("returns only meta fields", () => {
    const meta = getExerciseMeta("2.1");
    expect(meta.id).toBe("2.1");
    expect(meta.title).toBe("The Compiler Moment");
    expect(meta.starter_code).toContain("price = 10");
    expect(Array.isArray(meta.topics)).toBe(true);
    expect(meta.topics).toContain("variable assignment");
  });

  it("throws for unknown ID", () => {
    expect(() => getExerciseMeta("unknown")).toThrow("Unknown exercise: unknown");
  });
});

describe("getExerciseContent", () => {
  it("returns content with title and sandbox", () => {
    const content = getExerciseContent("2.1");
    expect(content.title).toBe("The Compiler Moment");
    expect(content.sandbox).toBe("pyodide");
    expect(content.intro.welcome).toContain("5 lines of Python");
    expect(content.steps).toHaveLength(4);
  });

  it("throws for unknown ID", () => {
    expect(() => getExerciseContent("unknown")).toThrow("Unknown exercise: unknown");
  });
});

describe("getExerciseRubric", () => {
  it("returns rubric with exercise context", () => {
    const rubric = getExerciseRubric("2.1");
    expect(rubric.id).toBe("2.1");
    expect(rubric.title).toBe("The Compiler Moment");
    expect(rubric.starter_code).toContain("price = 10");
    expect(rubric.dimensions).toHaveLength(3);
    expect(rubric.pass_threshold).toBe(0.6);
  });

  it("throws for unknown ID", () => {
    expect(() => getExerciseRubric("unknown")).toThrow("Unknown exercise: unknown");
  });
});

describe("Exercise 2.1 definition", () => {
  let ex: ExerciseDefinition;

  beforeAll(() => {
    ex = getExercise("2.1");
  });

  it("has discriminated union fields", () => {
    expect(ex.content_type).toBe("interactive-sandbox");
    expect(ex.sandbox).toBe("pyodide");
  });

  it("has correct title", () => {
    expect(ex.meta.title).toBe("The Compiler Moment");
  });

  it("has starter code with all 5 lines", () => {
    expect(ex.meta.starter_code).toContain("price = 10");
    expect(ex.meta.starter_code).toContain("tax = price * 0.2");
    expect(ex.meta.starter_code).toContain('label = "Total: " + str(price + tax)');
    expect(ex.meta.starter_code).toContain("cheap = price < 5");
    expect(ex.meta.starter_code).toContain('print(label, "| Cheap?", cheap)');
  });

  it("has topics as string array", () => {
    expect(Array.isArray(ex.meta.topics)).toBe(true);
    expect(ex.meta.topics).toContain("variable assignment");
    expect(ex.meta.topics).toContain("str() type conversion");
    expect(ex.meta.topics).toContain("TypeError when mixing types");
  });

  describe("steps", () => {
    const EXPECTED_STEP_COUNT = 4;

    it("has the right number of steps", () => {
      expect(ex.content.steps).toHaveLength(EXPECTED_STEP_COUNT);
    });

    it("step 0 is a predict step", () => {
      const step = ex.content.steps[0];
      expect(step.type).toBe("predict");
      expect(step.prompt).toContain("What do you think it will print");
    });

    it("step 1 is an experiment step", () => {
      const step = ex.content.steps[1];
      expect(step.type).toBe("experiment");
      expect(step.prompt).toContain("removing `str()`");
    });

    it("step 2 is an edit-and-predict step", () => {
      const step = ex.content.steps[2];
      expect(step.type).toBe("edit-and-predict");
      expect(step.prompt).toContain("What do you think will happen");
    });

    it("step 3 is a reflect step", () => {
      const step = ex.content.steps[3];
      expect(step.type).toBe("reflect");
      expect(step.prompt).toContain("What did you change");
    });

    it("has no showRun or input.type fields", () => {
      for (const step of ex.content.steps) {
        expect(step).not.toHaveProperty("showRun");
        expect(step).not.toHaveProperty("input");
      }
    });
  });

  describe("intro", () => {
    it("has a welcome message", () => {
      expect(ex.content.intro.welcome).toContain("5 lines of Python");
      expect(ex.content.intro.welcome).toContain("predict what the code will do");
    });
  });

  describe("rubric", () => {
    const EXPECTED_DIMENSION_COUNT = 3;
    const PASS_THRESHOLD = 0.6;

    it("has correct number of dimensions", () => {
      expect(ex.rubric.dimensions).toHaveLength(EXPECTED_DIMENSION_COUNT);
    });

    it("has correct pass threshold", () => {
      expect(ex.rubric.pass_threshold).toBe(PASS_THRESHOLD);
    });

    it("dimension weights sum to 1.0", () => {
      const totalWeight = ex.rubric.dimensions.reduce((sum, d) => sum + d.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0);
    });

    it("has code_comprehension dimension", () => {
      const dim = ex.rubric.dimensions.find((d) => d.key === "code_comprehension");
      expect(dim).toBeDefined();
      expect(dim!.weight).toBe(0.4);
    });

    it("has prediction_accuracy dimension", () => {
      const dim = ex.rubric.dimensions.find((d) => d.key === "prediction_accuracy");
      expect(dim).toBeDefined();
      expect(dim!.weight).toBe(0.3);
    });

    it("has modification_quality dimension", () => {
      const dim = ex.rubric.dimensions.find((d) => d.key === "modification_quality");
      expect(dim).toBeDefined();
      expect(dim!.weight).toBe(0.3);
    });

    it("each dimension has label and self_assessment_description", () => {
      for (const dim of ex.rubric.dimensions) {
        expect(dim.label).toBeDefined();
        expect(typeof dim.label).toBe("string");
        expect(dim.label.length).toBeGreaterThan(0);
        expect(dim.self_assessment_description).toBeDefined();
        expect(typeof dim.self_assessment_description).toBe("string");
        expect(dim.self_assessment_description.length).toBeGreaterThan(0);
      }
    });

    it("has step_summary for evaluator context", () => {
      expect(ex.rubric.step_summary).toBeDefined();
      expect(ex.rubric.step_summary).toContain("predict the output");
    });

    it("has scoring_guidance for each guided dimension", () => {
      expect(ex.rubric.scoring_guidance).toBeDefined();
      expect(ex.rubric.scoring_guidance.modification_quality).toContain("deliberate change");
      expect(ex.rubric.scoring_guidance.prediction_accuracy).toContain("prediction");
    });
  });
});
