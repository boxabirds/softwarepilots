import { describe, it, expect } from "vitest";
import { parseEvaluatorResponse } from "./response-parser";

const rubricDimensions = [
  { key: "code_comprehension", weight: 0.4 },
  { key: "prediction_accuracy", weight: 0.3 },
  { key: "modification_quality", weight: 0.3 },
];

describe("parseEvaluatorResponse", () => {
  it("parses valid JSON response", () => {
    const raw = JSON.stringify({
      scores: [
        { key: "code_comprehension", score: 8, feedback: "Good understanding" },
        { key: "prediction_accuracy", score: 6, feedback: "Decent prediction" },
        { key: "modification_quality", score: 7, feedback: "Solid change" },
      ],
    });

    const result = parseEvaluatorResponse(raw, rubricDimensions);
    expect(result).toHaveLength(3);
    expect(result[0].score).toBe(8);
    expect(result[0].key).toBe("code_comprehension");
    expect(result[0].weight).toBe(0.4);
    expect(result[0].feedback).toBe("Good understanding");
  });

  it("extracts JSON from markdown code block", () => {
    const raw = `Here is my evaluation:
\`\`\`json
{"scores": [
  {"key": "code_comprehension", "score": 7, "feedback": "OK"},
  {"key": "prediction_accuracy", "score": 5, "feedback": "Needs work"},
  {"key": "modification_quality", "score": 6, "feedback": "Decent"}
]}
\`\`\``;

    const result = parseEvaluatorResponse(raw, rubricDimensions);
    expect(result[0].score).toBe(7);
    expect(result[1].score).toBe(5);
  });

  it("clamps scores to valid range", () => {
    const raw = JSON.stringify({
      scores: [
        { key: "code_comprehension", score: 15, feedback: "Too high" },
        { key: "prediction_accuracy", score: -2, feedback: "Too low" },
        { key: "modification_quality", score: 5, feedback: "Normal" },
      ],
    });

    const result = parseEvaluatorResponse(raw, rubricDimensions);
    expect(result[0].score).toBe(10); // clamped to max
    expect(result[1].score).toBe(1); // clamped to min
    expect(result[2].score).toBe(5);
  });

  it("defaults missing dimensions to minimum score", () => {
    const raw = JSON.stringify({
      scores: [
        { key: "code_comprehension", score: 8, feedback: "Good" },
      ],
    });

    const result = parseEvaluatorResponse(raw, rubricDimensions);
    expect(result[0].score).toBe(8);
    expect(result[1].score).toBe(1); // missing → min
    expect(result[1].feedback).toContain("No feedback");
    expect(result[2].score).toBe(1);
  });

  it("throws on completely unparseable response", () => {
    expect(() =>
      parseEvaluatorResponse("This is not JSON at all", rubricDimensions)
    ).toThrow("missing 'scores' array");
  });

  it("throws when scores field is not an array", () => {
    const raw = JSON.stringify({ scores: "not an array" });
    expect(() =>
      parseEvaluatorResponse(raw, rubricDimensions)
    ).toThrow("missing 'scores' array");
  });

  it("rounds fractional scores", () => {
    const raw = JSON.stringify({
      scores: [
        { key: "code_comprehension", score: 7.6, feedback: "Good" },
        { key: "prediction_accuracy", score: 4.3, feedback: "OK" },
        { key: "modification_quality", score: 5.5, feedback: "Decent" },
      ],
    });

    const result = parseEvaluatorResponse(raw, rubricDimensions);
    expect(result[0].score).toBe(8);
    expect(result[1].score).toBe(4);
    expect(result[2].score).toBe(6);
  });
});
