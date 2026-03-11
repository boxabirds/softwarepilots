import { describe, it, expect } from "vitest";
import { buildEvaluationPrompt } from "./prompt-builder";

const rubric = {
  id: "2.1",
  title: "The Compiler Moment",
  starter_code: 'print("original")',
  dimensions: [
    { key: "code_comprehension", weight: 0.4, description: "Understands each line" },
    { key: "prediction_accuracy", weight: 0.3, description: "Predicted output correctly" },
    { key: "modification_quality", weight: 0.3, description: "Intentional modification" },
  ],
  pass_threshold: 0.6,
  step_summary: "The learner was asked to predict output, run code, make modifications, and reflect.",
  scoring_guidance: {
    modification_quality: "Score based on whether the learner made a deliberate change and understood why.",
    prediction_accuracy: "Compare the learner's prediction text against the console output.",
  },
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

  it("includes step_summary as CONTEXT", () => {
    const { system } = buildEvaluationPrompt(rubric, content);
    expect(system).toContain("CONTEXT: The learner was asked to predict output");
  });

  it("includes scoring_guidance as IMPORTANT blocks", () => {
    const { system } = buildEvaluationPrompt(rubric, content);
    expect(system).toContain("IMPORTANT for modification_quality: Score based on whether the learner made a deliberate change");
    expect(system).toContain("IMPORTANT for prediction_accuracy: Compare the learner's prediction text");
  });

  it("does not contain hardcoded exercise-specific text", () => {
    const { system } = buildEvaluationPrompt(rubric, content);
    expect(system).not.toContain("removing str()");
    expect(system).not.toContain("Predict what it would print");
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

  it("works with empty scoring_guidance", () => {
    const minimalRubric = { ...rubric, scoring_guidance: {} };
    const { system } = buildEvaluationPrompt(minimalRubric, content);
    expect(system).not.toContain("IMPORTANT for");
    expect(system).toContain("CONTEXT:");
  });
});
