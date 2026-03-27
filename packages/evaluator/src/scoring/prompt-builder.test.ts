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

const TEST_SYSTEM_TEMPLATE = `You are an educational evaluator for the Software Pilotry Foundation Course.
You are scoring exercise "The Compiler Moment" (2.1).

CONTEXT: The learner was asked to predict output, run code, make modifications, and reflect.

The learner's descriptions under "Modifications" explain what THEY CHANGED and why - not the original code. Evaluate them in that context.

IMPORTANT for modification_quality: Score based on whether the learner made a deliberate change and understood why.

IMPORTANT for prediction_accuracy: Compare the learner's prediction text against the console output.

Score the learner's submission on each dimension using a 1-10 scale.
Provide specific, constructive feedback for each dimension. Keep feedback concise (1-2 sentences).

Dimensions to evaluate:
- "code_comprehension" (weight 0.4): Understands each line
- "prediction_accuracy" (weight 0.3): Predicted output correctly
- "modification_quality" (weight 0.3): Intentional modification

You MUST respond with valid JSON matching this exact schema:
{
  "scores": [
    { "key": "<dimension_key>", "score": <1-10>, "feedback": "<specific feedback>" }
  ]
}

Do not include any text outside the JSON object.`;

describe("buildEvaluationPrompt", () => {
  it("includes all rubric dimensions in system prompt", () => {
    const { system } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(system).toContain("code_comprehension");
    expect(system).toContain("prediction_accuracy");
    expect(system).toContain("modification_quality");
  });

  it("includes exercise title and ID", () => {
    const { system } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(system).toContain("The Compiler Moment");
    expect(system).toContain("2.1");
  });

  it("includes step_summary as CONTEXT", () => {
    const { system } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(system).toContain("CONTEXT: The learner was asked to predict output");
  });

  it("includes scoring_guidance as IMPORTANT blocks", () => {
    const { system } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(system).toContain("IMPORTANT for modification_quality: Score based on whether the learner made a deliberate change");
    expect(system).toContain("IMPORTANT for prediction_accuracy: Compare the learner's prediction text");
  });

  it("does not contain hardcoded exercise-specific text", () => {
    const { system } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(system).not.toContain("removing str()");
    expect(system).not.toContain("Predict what it would print");
  });

  it("includes learner code in user prompt", () => {
    const { user } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(user).toContain('print("hello")');
  });

  it("includes console output in user prompt", () => {
    const { user } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(user).toContain("hello");
  });

  it("includes modifications in user prompt", () => {
    const { user } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(user).toContain("Changed the string");
  });

  it("includes starter code in user prompt", () => {
    const { user } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(user).toContain("Starter Code");
    expect(user).toContain('print("original")');
  });

  it("handles empty modifications array", () => {
    const { user } = buildEvaluationPrompt(rubric, {
      ...content,
      modifications: [],
    }, TEST_SYSTEM_TEMPLATE);
    expect(user).toContain("did not describe any modifications");
  });

  it("requests JSON output format", () => {
    const { system } = buildEvaluationPrompt(rubric, content, TEST_SYSTEM_TEMPLATE);
    expect(system).toContain("valid JSON");
    expect(system).toContain('"scores"');
  });

  it("works with empty scoring_guidance", () => {
    const minimalRubric = { ...rubric, scoring_guidance: {} };
    const minimalTemplate = TEST_SYSTEM_TEMPLATE.replace(/IMPORTANT for [^\n]+\n\n/g, "");
    const { system } = buildEvaluationPrompt(minimalRubric, content, minimalTemplate);
    expect(system).not.toContain("IMPORTANT for");
    expect(system).toContain("CONTEXT:");
  });
});
