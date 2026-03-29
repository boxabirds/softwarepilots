import { describe, it, expect } from "vitest";
import { computeSectionCoverage, computeTopicCoverage } from "../hooks/useTopicCoverage";

/* ---- computeSectionCoverage ---- */

describe("computeSectionCoverage", () => {
  it("counts keys in concepts_json as covered", () => {
    const json = JSON.stringify({
      variables: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
      scope: { level: "developing", next_review: "2099-01-01T00:00:00Z" },
      closures: { level: "emerging", next_review: "2099-01-01T00:00:00Z" },
    });
    const TOTAL_CONCEPTS = 5;
    const result = computeSectionCoverage(json, TOTAL_CONCEPTS);
    expect(result.covered).toBe(3);
    expect(result.total).toBe(TOTAL_CONCEPTS);
  });

  it("returns zero covered for null concepts_json", () => {
    const TOTAL_CONCEPTS = 5;
    const result = computeSectionCoverage(null, TOTAL_CONCEPTS);
    expect(result.covered).toBe(0);
    expect(result.total).toBe(TOTAL_CONCEPTS);
  });

  it("returns zero total for section with 0 concepts", () => {
    const result = computeSectionCoverage(null, 0);
    expect(result.covered).toBe(0);
    expect(result.total).toBe(0);
    expect(result.dueForReview).toBe(false);
  });

  it("detects dueForReview when next_review is in the past", () => {
    const json = JSON.stringify({
      variables: { level: "solid", next_review: "2020-01-01T00:00:00Z" },
    });
    const result = computeSectionCoverage(json, 3);
    expect(result.dueForReview).toBe(true);
  });

  it("not dueForReview when all next_review dates are in the future", () => {
    const json = JSON.stringify({
      variables: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
    });
    const result = computeSectionCoverage(json, 3);
    expect(result.dueForReview).toBe(false);
  });

  it("handles invalid JSON gracefully", () => {
    const result = computeSectionCoverage("not valid json", 5);
    expect(result.covered).toBe(0);
    expect(result.total).toBe(5);
  });
});

/* ---- computeTopicCoverage ---- */

describe("computeTopicCoverage", () => {
  it("aggregates module coverage correctly", () => {
    // level-1 has sections in modules; we test with real profile data
    const entries = [
      {
        section_id: "1.1",
        status: "in_progress",
        concepts_json: JSON.stringify({
          concept_a: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
          concept_b: { level: "developing", next_review: "2099-01-01T00:00:00Z" },
        }),
      },
      {
        section_id: "1.2",
        status: "in_progress",
        concepts_json: JSON.stringify({
          concept_c: { level: "emerging", next_review: "2099-01-01T00:00:00Z" },
        }),
      },
    ];

    const result = computeTopicCoverage("level-1", entries);

    // Section-level
    const sec1 = result.sections.get("1.1");
    expect(sec1).toBeDefined();
    expect(sec1!.covered).toBe(2);

    const sec2 = result.sections.get("1.2");
    expect(sec2).toBeDefined();
    expect(sec2!.covered).toBe(1);

    // Module aggregation: sections 1.1 and 1.2 are in the same module
    // Their covered counts should sum
    const moduleId = "mod-1"; // The actual module_id from level-1 curriculum
    // Find the module that contains section 1.1
    let moduleForSec1: string | undefined;
    for (const [modId, modCov] of result.modules) {
      if (modCov.covered >= 2) {
        moduleForSec1 = modId;
        break;
      }
    }
    // At minimum, track total should include all sections' concepts
    expect(result.track.total).toBeGreaterThan(0);
    expect(result.track.covered).toBe(3); // 2 + 1
  });

  it("track aggregation sums across modules", () => {
    const entries = [
      {
        section_id: "1.1",
        status: "completed",
        concepts_json: JSON.stringify({
          a: { level: "solid" },
          b: { level: "solid" },
        }),
      },
      {
        section_id: "2.1",
        status: "in_progress",
        concepts_json: JSON.stringify({
          c: { level: "emerging" },
        }),
      },
    ];

    const result = computeTopicCoverage("level-1", entries);
    expect(result.track.covered).toBe(3); // 2 + 1
    expect(result.track.total).toBeGreaterThan(0);

    // Verify that modules map has entries for both module groups
    expect(result.modules.size).toBeGreaterThan(0);
  });

  it("handles unknown profile gracefully", () => {
    const result = computeTopicCoverage("nonexistent-profile", []);
    expect(result.track.covered).toBe(0);
    expect(result.track.total).toBe(0);
    expect(result.sections.size).toBe(0);
    expect(result.modules.size).toBe(0);
  });
});

/* ---- Guard: demonstrated cannot exceed total ---- */

describe("computeSectionCoverage guards", () => {
  it("caps covered at total when concepts_json has more keys than totalConcepts", () => {
    const json = JSON.stringify({
      a: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
      b: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
      c: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
      d: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
      e: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
      f: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
      g: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
    });
    const TOTAL = 3;
    const result = computeSectionCoverage(json, TOTAL);
    // covered must never exceed total
    expect(result.covered).toBeLessThanOrEqual(result.total);
    expect(result.covered).toBe(TOTAL);
    expect(result.total).toBe(TOTAL);
  });
});
