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
  });
});
