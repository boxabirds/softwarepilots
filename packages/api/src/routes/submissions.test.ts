import { describe, it, expect } from "bun:test";
import { validateSubmission } from "./submissions";

const validPayload = () => ({
  module_id: "2",
  exercise_id: "2.1",
  content: {
    code: 'print("hello")',
    console_output: "hello",
    modifications: ["Changed the print statement"],
  },
  self_assessment: {
    predictions: {
      code_comprehension: 7,
      prediction_accuracy: 5,
      modification_quality: 6,
    },
    weakest_dimension: "prediction_accuracy",
  },
});

describe("validateSubmission", () => {
  it("returns null for a valid payload", () => {
    expect(validateSubmission(validPayload())).toBeNull();
  });

  it("rejects missing module_id", () => {
    const p = validPayload();
    p.module_id = "";
    expect(validateSubmission(p)).toContain("module_id");
  });

  it("rejects missing exercise_id", () => {
    const p = validPayload();
    p.exercise_id = "";
    expect(validateSubmission(p)).toContain("exercise_id");
  });

  it("rejects unknown exercise_id", () => {
    const p = validPayload();
    p.exercise_id = "99.9";
    expect(validateSubmission(p)).toContain("Unknown exercise");
  });

  it("rejects missing content.code", () => {
    const p = validPayload();
    p.content.code = "";
    expect(validateSubmission(p)).toContain("content.code");
  });

  it("accepts missing self_assessment (optional)", () => {
    const p = validPayload();
    delete (p as Record<string, unknown>).self_assessment;
    expect(validateSubmission(p)).toBeNull();
  });

  it("rejects missing self_assessment.predictions when self_assessment is provided", () => {
    const p = validPayload();
    (p.self_assessment as Record<string, unknown>).predictions = undefined;
    expect(validateSubmission(p)).toContain("predictions");
  });

  it("rejects missing weakest_dimension when self_assessment is provided", () => {
    const p = validPayload();
    p.self_assessment!.weakest_dimension = "";
    expect(validateSubmission(p)).toContain("weakest_dimension");
  });

  it("rejects prediction scores below minimum", () => {
    const p = validPayload();
    p.self_assessment.predictions.code_comprehension = 0;
    expect(validateSubmission(p)).toContain("code_comprehension");
  });

  it("rejects prediction scores above maximum", () => {
    const p = validPayload();
    p.self_assessment.predictions.code_comprehension = 11;
    expect(validateSubmission(p)).toContain("code_comprehension");
  });

  it("rejects non-numeric prediction scores", () => {
    const p = validPayload();
    (p.self_assessment.predictions as Record<string, unknown>).code_comprehension = "high";
    expect(validateSubmission(p)).toContain("code_comprehension");
  });
});
