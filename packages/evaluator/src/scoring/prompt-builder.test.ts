import { describe, it, expect } from "vitest";
import { buildEvaluationPrompt } from "./prompt-builder";

const rubric = {
  exercise_id: "2.1",
  title: "The Compiler Moment",
  starter_code: 'print("original")',
  dimensions: [
    { key: "code_comprehension", weight: 0.4, description: "Understands each line" },
    { key: "prediction_accuracy", weight: 0.3, description: "Predicted output correctly" },
    { key: "modification_quality", weight: 0.3, description: "Intentional modification" },
  ],
  pass_threshold: 0.6,
};

const content = {
  code: 'print("hello")',
  console_output: "hello",
  modifications: ["Changed the string"],
};

describe("buildEvaluationPrompt", () => {
  it("includes all rubric dimensions in system prompt", () => {
    const { system } = buildEvaluationPrompt(rubric, content);
    expect(system).toContain("code_comprehension");
    expect(system).toContain("prediction_accuracy");
    expect(system).toContain("modification_quality");
  });

  it("includes exercise title and ID", () => {
    const { system } = buildEvaluationPrompt(rubric, content);
    expect(system).toContain("The Compiler Moment");
    expect(system).toContain("2.1");
  });

  it("includes learner code in user prompt", () => {
    const { user } = buildEvaluationPrompt(rubric, content);
    expect(user).toContain('print("hello")');
  });

  it("includes console output in user prompt", () => {
    const { user } = buildEvaluationPrompt(rubric, content);
    expect(user).toContain("hello");
  });

  it("includes modifications in user prompt", () => {
    const { user } = buildEvaluationPrompt(rubric, content);
    expect(user).toContain("Changed the string");
  });

  it("includes starter code in user prompt", () => {
    const { user } = buildEvaluationPrompt(rubric, content);
    expect(user).toContain("Starter Code");
    expect(user).toContain('print("original")');
  });

  it("handles empty modifications array", () => {
    const { user } = buildEvaluationPrompt(rubric, {
      ...content,
      modifications: [],
    });
    expect(user).toContain("did not describe any modifications");
  });

  it("requests JSON output format", () => {
    const { system } = buildEvaluationPrompt(rubric, content);
    expect(system).toContain("valid JSON");
    expect(system).toContain('"scores"');
  });
});
