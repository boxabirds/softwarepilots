import { describe, it, expect } from "bun:test";
import {
  updateConceptAssessment,
  parseConceptsJson,
} from "../spaced-repetition";
import type { ConceptsMap } from "../spaced-repetition";

const FIXED_DATE = new Date("2025-06-15T12:00:00.000Z");

describe("updateConceptAssessment", () => {
  it("creates a new concept entry with review_count 1", () => {
    const result = updateConceptAssessment({}, "concurrency", "solid", FIXED_DATE);
    expect(result.concurrency).toBeTruthy();
    expect(result.concurrency.level).toBe("solid");
    expect(result.concurrency.review_count).toBe(1);
    expect(result.concurrency.last_reviewed).toBe(FIXED_DATE.toISOString());
  });

  it("sets correct interval for each level", () => {
    const levels = [
      { level: "emerging", expectedDays: 1 },
      { level: "developing", expectedDays: 3 },
      { level: "solid", expectedDays: 7 },
      { level: "strong", expectedDays: 21 },
    ];

    for (const { level, expectedDays } of levels) {
      const result = updateConceptAssessment({}, "test", level, FIXED_DATE);
      const nextReview = new Date(result.test.next_review);
      const diffMs = nextReview.getTime() - FIXED_DATE.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(expectedDays);
    }
  });

  it("increments review_count on subsequent calls", () => {
    let map: ConceptsMap = {};
    map = updateConceptAssessment(map, "testing", "emerging", FIXED_DATE);
    expect(map.testing.review_count).toBe(1);

    map = updateConceptAssessment(map, "testing", "developing", FIXED_DATE);
    expect(map.testing.review_count).toBe(2);
    expect(map.testing.level).toBe("developing");
  });

  it("does not mutate the input map", () => {
    const original: ConceptsMap = {};
    const result = updateConceptAssessment(original, "x", "solid", FIXED_DATE);
    expect(original).toEqual({});
    expect(result.x).toBeTruthy();
  });

  it("ignores invalid levels and returns existing map unchanged", () => {
    const existing: ConceptsMap = {
      a: {
        level: "solid",
        last_reviewed: "2025-01-01T00:00:00.000Z",
        next_review: "2025-01-08T00:00:00.000Z",
        review_count: 1,
      },
    };
    const result = updateConceptAssessment(existing, "b", "expert", FIXED_DATE);
    expect(result).toEqual(existing);
  });

  it("handles whitespace in level string", () => {
    const result = updateConceptAssessment({}, "x", "  Solid  ", FIXED_DATE);
    expect(result.x.level).toBe("solid");
  });

  it("preserves other concepts when updating one", () => {
    let map: ConceptsMap = {};
    map = updateConceptAssessment(map, "a", "solid", FIXED_DATE);
    map = updateConceptAssessment(map, "b", "emerging", FIXED_DATE);
    expect(map.a).toBeTruthy();
    expect(map.b).toBeTruthy();
    expect(map.a.level).toBe("solid");
    expect(map.b.level).toBe("emerging");
  });
});

describe("parseConceptsJson", () => {
  it("returns empty map for null", () => {
    expect(parseConceptsJson(null)).toEqual({});
  });

  it("returns empty map for undefined", () => {
    expect(parseConceptsJson(undefined)).toEqual({});
  });

  it("returns empty map for empty string", () => {
    expect(parseConceptsJson("")).toEqual({});
  });

  it("returns empty map for invalid JSON", () => {
    expect(parseConceptsJson("{broken")).toEqual({});
  });

  it("returns empty map for array JSON", () => {
    expect(parseConceptsJson("[]")).toEqual({});
  });

  it("parses valid concepts JSON", () => {
    const data: ConceptsMap = {
      testing: {
        level: "solid",
        last_reviewed: "2025-01-01T00:00:00.000Z",
        next_review: "2025-01-08T00:00:00.000Z",
        review_count: 2,
      },
    };
    expect(parseConceptsJson(JSON.stringify(data))).toEqual(data);
  });
});
