import { describe, it, expect } from "vitest";
import {
  computeOverallScore,
  computeCalibrationGaps,
  buildScoringResult,
  type DimensionScore,
} from "./gap-calculator";

const makeDimensions = (scores: number[]): DimensionScore[] => [
  { key: "code_comprehension", score: scores[0], weight: 0.4, feedback: "" },
  { key: "prediction_accuracy", score: scores[1], weight: 0.3, feedback: "" },
  { key: "modification_quality", score: scores[2], weight: 0.3, feedback: "" },
];

describe("computeOverallScore", () => {
  it("computes weighted average correctly", () => {
    const dims = makeDimensions([8, 6, 7]);
    // (8*0.4 + 6*0.3 + 7*0.3) / 1.0 = 3.2 + 1.8 + 2.1 = 7.1
    expect(computeOverallScore(dims)).toBeCloseTo(7.1);
  });

  it("returns 0 for empty dimensions", () => {
    expect(computeOverallScore([])).toBe(0);
  });

  it("handles all equal scores", () => {
    const dims = makeDimensions([5, 5, 5]);
    expect(computeOverallScore(dims)).toBeCloseTo(5.0);
  });
});

describe("computeCalibrationGaps", () => {
  it("computes gaps as actual minus predicted", () => {
    const dims = makeDimensions([8, 4, 7]);
    const predictions = {
      code_comprehension: 6,
      prediction_accuracy: 7,
      modification_quality: 7,
    };
    const gaps = computeCalibrationGaps(dims, predictions);

    expect(gaps[0].gap).toBe(2); // underestimated
    expect(gaps[1].gap).toBe(-3); // overestimated
    expect(gaps[2].gap).toBe(0); // exact
  });

  it("defaults to 0 for missing predictions", () => {
    const dims = makeDimensions([8, 4, 7]);
    const gaps = computeCalibrationGaps(dims, {});

    expect(gaps[0].predicted).toBe(0);
    expect(gaps[0].gap).toBe(8);
  });
});

describe("buildScoringResult", () => {
  it("marks as passed when normalised score meets threshold", () => {
    // Overall = 7.1, normalised = 7.1/10 = 0.71, threshold = 0.6
    const dims = makeDimensions([8, 6, 7]);
    const result = buildScoringResult(dims, {}, 0.6);
    expect(result.passed).toBe(true);
  });

  it("marks as failed when normalised score is below threshold", () => {
    // Overall = 2.0, normalised = 0.2, threshold = 0.6
    const dims = makeDimensions([2, 2, 2]);
    const result = buildScoringResult(dims, {}, 0.6);
    expect(result.passed).toBe(false);
  });

  it("includes calibration gaps in result", () => {
    const dims = makeDimensions([8, 6, 7]);
    const predictions = { code_comprehension: 5 };
    const result = buildScoringResult(dims, predictions, 0.6);
    expect(result.calibration_gaps[0].gap).toBe(3);
  });
});
