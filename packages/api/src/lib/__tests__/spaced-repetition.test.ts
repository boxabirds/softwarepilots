<<<<<<< HEAD
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  calculateNextReview,
  getConceptsDueForReview,
  updateConceptAssessment,
  type ConceptAssessment,
} from "../spaced-repetition";

describe("calculateNextReview", () => {
  it("returns correct intervals for each understanding level", () => {
    expect(calculateNextReview("emerging", false)).toBe(1);
    expect(calculateNextReview("developing", false)).toBe(3);
    expect(calculateNextReview("solid", false)).toBe(7);
    expect(calculateNextReview("strong", false)).toBe(14);
  });

  it("halves interval when needed_instruction is true", () => {
    expect(calculateNextReview("emerging", true)).toBe(0.5);
    expect(calculateNextReview("developing", true)).toBe(1.5);
    expect(calculateNextReview("solid", true)).toBe(3.5);
    expect(calculateNextReview("strong", true)).toBe(7);
  });

  it("defaults to 1 for unknown level", () => {
    expect(calculateNextReview("unknown", false)).toBe(1);
    expect(calculateNextReview("", false)).toBe(1);
  });
});

describe("getConceptsDueForReview", () => {
  const MS_PER_DAY = 86_400_000;

  it("concept assessed 1 day ago with 1-day interval is due", () => {
    const now = new Date("2026-03-21T12:00:00Z");
    const oneDayAgo = new Date(now.getTime() - MS_PER_DAY).toISOString();

    const concepts: Record<string, ConceptAssessment> = {
      variables: {
        understanding_level: "emerging",
        last_assessed: oneDayAgo,
        review_interval_days: 1,
        needed_instruction: false,
      },
    };

    const result = getConceptsDueForReview(concepts, now);
    expect(result).toHaveLength(1);
    expect(result[0].concept).toBe("variables");
    expect(result[0].days_overdue).toBeGreaterThanOrEqual(0);
  });

  it("concept assessed 1 day ago with 7-day interval is not due", () => {
    const now = new Date("2026-03-21T12:00:00Z");
    const oneDayAgo = new Date(now.getTime() - MS_PER_DAY).toISOString();

    const concepts: Record<string, ConceptAssessment> = {
      loops: {
        understanding_level: "solid",
        last_assessed: oneDayAgo,
        review_interval_days: 7,
        needed_instruction: false,
      },
    };

    const result = getConceptsDueForReview(concepts, now);
    expect(result).toHaveLength(0);
  });

  it("concept never assessed (no entry) is not in result", () => {
    const result = getConceptsDueForReview({}, new Date());
    expect(result).toHaveLength(0);
  });

  it("empty conceptsJson returns empty array", () => {
    const result = getConceptsDueForReview({});
    expect(result).toEqual([]);
  });

  it("sorts by days_overdue descending", () => {
    const now = new Date("2026-03-21T12:00:00Z");

    const concepts: Record<string, ConceptAssessment> = {
      arrays: {
        understanding_level: "emerging",
        last_assessed: new Date(
          now.getTime() - 3 * MS_PER_DAY,
        ).toISOString(),
        review_interval_days: 1,
        needed_instruction: false,
      },
      functions: {
        understanding_level: "developing",
        last_assessed: new Date(
          now.getTime() - 10 * MS_PER_DAY,
        ).toISOString(),
        review_interval_days: 3,
        needed_instruction: false,
      },
      objects: {
        understanding_level: "solid",
        last_assessed: new Date(
          now.getTime() - 2 * MS_PER_DAY,
        ).toISOString(),
        review_interval_days: 1,
        needed_instruction: true,
      },
    };

    const result = getConceptsDueForReview(concepts, now);
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].days_overdue).toBeGreaterThanOrEqual(
        result[i].days_overdue,
      );
    }
  });
});

describe("updateConceptAssessment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("new concept gets initial interval", () => {
    const result = updateConceptAssessment({}, "variables", "emerging", false);

    expect(result.variables).toBeDefined();
    expect(result.variables.understanding_level).toBe("emerging");
    expect(result.variables.review_interval_days).toBe(1);
    expect(result.variables.needed_instruction).toBe(false);
  });

  it("maintained understanding doubles interval", () => {
    const existing: Record<string, ConceptAssessment> = {
      loops: {
        understanding_level: "solid",
        last_assessed: "2026-03-14T12:00:00Z",
        review_interval_days: 7,
        needed_instruction: false,
      },
    };

    const result = updateConceptAssessment(existing, "loops", "solid", false);
    expect(result.loops.review_interval_days).toBe(14);
  });

  it("regressed understanding resets to 1 day", () => {
    const existing: Record<string, ConceptAssessment> = {
      loops: {
        understanding_level: "solid",
        last_assessed: "2026-03-14T12:00:00Z",
        review_interval_days: 7,
        needed_instruction: false,
      },
    };

    const result = updateConceptAssessment(
      existing,
      "loops",
      "emerging",
      false,
    );
    expect(result.loops.review_interval_days).toBe(1);
  });

  it("sets last_assessed to current time", () => {
    const result = updateConceptAssessment(
      {},
      "variables",
      "developing",
      false,
    );
    expect(result.variables.last_assessed).toBe("2026-03-21T12:00:00.000Z");
=======
import { describe, it, expect } from "vitest";
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
>>>>>>> worktree-agent-abc03ae8
  });
});
