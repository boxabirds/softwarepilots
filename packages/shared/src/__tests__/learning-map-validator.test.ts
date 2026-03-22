import { describe, it, expect } from "vitest";
import { validateLearningMap } from "../curricula/learning-map-validator";
import type { SectionLearningMap } from "../curricula";

function makeValidMap(overrides?: Partial<SectionLearningMap>): SectionLearningMap {
  return {
    section_id: "test-section",
    generated_at: "2026-01-01T00:00:00Z",
    model_used: "test-model",
    prerequisites: [],
    core_claims: [
      { id: "c1", statement: "Claim 1", concepts: ["A", "B"], demonstration_criteria: "Can build a working example" },
      { id: "c2", statement: "Claim 2", concepts: ["C"], demonstration_criteria: "Can explain the tradeoffs" },
      { id: "c3", statement: "Claim 3", concepts: ["D"], demonstration_criteria: "Can identify failure modes" },
    ],
    key_misconceptions: [
      { id: "m1", belief: "Wrong belief", correction: "Right answer", related_claims: ["c1"] },
    ],
    key_intuition_decomposition: [
      { id: "si1", statement: "First insight", order: 1 },
      { id: "si2", statement: "Second insight", order: 2 },
    ],
    ...overrides,
  };
}

const ALL_CONCEPTS = ["A", "B", "C", "D"];

describe("validateLearningMap", () => {
  it("valid map with 3 claims and full concept coverage passes", () => {
    const result = validateLearningMap(makeValidMap(), ALL_CONCEPTS);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("valid map with 7 claims passes", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A"], demonstration_criteria: "Can build it" },
        { id: "c2", statement: "C2", concepts: ["B"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["C"], demonstration_criteria: "Can build it" },
        { id: "c4", statement: "C4", concepts: ["D"], demonstration_criteria: "Can build it" },
        { id: "c5", statement: "C5", concepts: ["A"], demonstration_criteria: "Can build it" },
        { id: "c6", statement: "C6", concepts: ["B"], demonstration_criteria: "Can build it" },
        { id: "c7", statement: "C7", concepts: ["C"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(true);
  });

  it("rejects map with 2 claims (below minimum)", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A", "B", "C", "D"], demonstration_criteria: "Can build it" },
        { id: "c2", statement: "C2", concepts: ["A"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("3-7 core_claims, got 2"));
  });

  it("rejects map with 8 claims (above maximum)", () => {
    const claims = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i + 1}`,
      statement: `Claim ${i + 1}`,
      concepts: i < 4 ? [ALL_CONCEPTS[i]] : ["A"],
      demonstration_criteria: "Can build it",
    }));
    const map = makeValidMap({ core_claims: claims });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("3-7 core_claims, got 8"));
  });

  it("rejects missing concept coverage", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A"], demonstration_criteria: "Can build it" },
        { id: "c2", statement: "C2", concepts: ["B"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["C"], demonstration_criteria: "Can build it" },
        // "D" is not covered
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('concept "D" not covered'));
  });

  it("rejects vague demonstration criteria - 'understands'", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A", "B"], demonstration_criteria: "Understands the concept" },
        { id: "c2", statement: "C2", concepts: ["C"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["D"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('vague demonstration_criteria'));
  });

  it("rejects vague demonstration criteria - 'knows'", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A", "B"], demonstration_criteria: "Knows the difference" },
        { id: "c2", statement: "C2", concepts: ["C"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["D"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('"knows"'));
  });

  it("rejects vague demonstration criteria - 'familiar with'", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A", "B"], demonstration_criteria: "Is familiar with the topic" },
        { id: "c2", statement: "C2", concepts: ["C"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["D"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('"familiar with"'));
  });

  it("rejects claim with no concepts", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: [], demonstration_criteria: "Can build it" },
        { id: "c2", statement: "C2", concepts: ["A", "B", "C", "D"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["A"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('"c1" has no concepts'));
  });

  it("rejects 1 sub-insight (below minimum)", () => {
    const map = makeValidMap({
      key_intuition_decomposition: [
        { id: "si1", statement: "Only one", order: 1 },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("2-4 key_intuition_decomposition entries, got 1"));
  });

  it("rejects 5 sub-insights (above maximum)", () => {
    const map = makeValidMap({
      key_intuition_decomposition: Array.from({ length: 5 }, (_, i) => ({
        id: `si${i + 1}`,
        statement: `Insight ${i + 1}`,
        order: i + 1,
      })),
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("2-4 key_intuition_decomposition entries, got 5"));
  });

  it("rejects duplicate claim IDs", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A", "B"], demonstration_criteria: "Can build it" },
        { id: "c1", statement: "C2", concepts: ["C"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["D"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('Duplicate claim ID: "c1"'));
  });

  it("rejects misconception referencing invalid claim ID", () => {
    const map = makeValidMap({
      key_misconceptions: [
        { id: "m1", belief: "Wrong", correction: "Right", related_claims: ["nonexistent"] },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('references unknown claim "nonexistent"'));
  });

  it("accumulates multiple errors", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: [], demonstration_criteria: "Understands it" },
      ],
      key_intuition_decomposition: [],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    // Should have errors for: claim count, no concepts, vague criteria, missing coverage, sub-insight count
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});
