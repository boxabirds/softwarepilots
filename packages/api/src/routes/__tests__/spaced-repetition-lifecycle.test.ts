/**
 * Clock-controlled spaced repetition lifecycle tests (Story 62).
 *
 * All tests use fixed dates passed as parameters - no fake timers needed.
 * Tests the full lifecycle: concept emergence -> due detection -> review ->
 * decay -> status regression -> recovery. All on the enrollment entity.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  updateConceptAssessment,
  getConceptsDueForReview,
  parseConceptsJson,
} from "../../lib/spaced-repetition";
import type { ConceptsMap } from "../../lib/spaced-repetition";
import { evaluateClaimDecay, computeClaimProgress } from "../curriculum-progress";
import {
  getEnrollmentConcepts,
  updateEnrollmentConcepts,
  countTopicsCovered,
} from "../../lib/enrollment-store";
import type { SectionLearningMap, Claim } from "@softwarepilots/shared";

/* ---- D1 shim ---- */

function createD1Shim(sqliteDb: InstanceType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) { bindings = values; return this; },
        async first<T>(columnName?: string): Promise<T | null> {
          const stmt = sqliteDb.prepare(query);
          const row = stmt.get(...bindings) as Record<string, unknown> | undefined;
          if (!row) return null;
          if (columnName) return (row[columnName] as T) ?? null;
          return row as T;
        },
        async all<T>(): Promise<D1Result<T>> {
          const stmt = sqliteDb.prepare(query);
          const rows = stmt.all(...bindings) as T[];
          return { results: rows, success: true, meta: {} as D1Result<T>["meta"] };
        },
        async run(): Promise<D1Response> {
          const stmt = sqliteDb.prepare(query);
          const info = stmt.run(...bindings);
          return { success: true, meta: { duration: 0, changes: info.changes, last_row_id: info.lastInsertRowid as number, changed_db: info.changes > 0, size_after: 0, rows_read: 0, rows_written: info.changes } };
        },
      } as unknown as D1PreparedStatement;
    },
    async batch<T>(): Promise<D1Result<T>[]> { throw new Error("not implemented"); },
    async dump(): Promise<ArrayBuffer> { throw new Error("not implemented"); },
    async exec(): Promise<D1ExecResult> { throw new Error("not implemented"); },
  } as unknown as D1Database;
}

/* ---- Time helpers ---- */

const DAY_0 = new Date("2025-06-15T12:00:00.000Z");

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/* ---- Fixtures ---- */

const ENROLLMENT_ID = "enrollment-001";

function makeClaim(id: string, concepts: string[]): Claim {
  return { id, statement: `Claim ${id}`, concepts, demonstration_criteria: `Can demonstrate ${id}` };
}

function makeLearningMap(claims: Claim[]): SectionLearningMap {
  return {
    section_id: "0.1",
    generated_at: DAY_0.toISOString(),
    model_used: "test",
    prerequisites: [],
    core_claims: claims,
    key_misconceptions: [],
    key_intuition_decomposition: [{ id: "insight-1", statement: "Test insight", order: 1 }, { id: "insight-2", statement: "Test insight 2", order: 2 }],
  };
}

/* ---- Setup ---- */

let sqliteDb: InstanceType<typeof Database>;
let db: D1Database;

beforeEach(() => {
  sqliteDb = new Database(":memory:");
  sqliteDb.exec(`
    CREATE TABLE enrollments (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      profile TEXT NOT NULL,
      curriculum_version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      concepts_json TEXT,
      enrolled_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (learner_id, profile)
    );
  `);
  // Seed enrollment
  sqliteDb.exec(`INSERT INTO enrollments (id, learner_id, profile, curriculum_version) VALUES ('${ENROLLMENT_ID}', 'learner-1', 'level-0', 1)`);
  db = createD1Shim(sqliteDb);
});

afterEach(() => { sqliteDb?.close(); });

/* ---- Concept emergence ---- */

describe("Concept emergence", () => {
  it("concept added at day 0 has level 'emerging' and next_review at day 1", async () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "emerging", DAY_0);

    expect(concepts.Servers.level).toBe("emerging");
    expect(concepts.Servers.review_count).toBe(1);

    const nextReview = new Date(concepts.Servers.next_review);
    const expectedNextReview = addDays(DAY_0, 1);
    expect(nextReview.toISOString()).toBe(expectedNextReview.toISOString());
  });

  it("concept written to enrollment is readable from enrollment", async () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "APIs", "emerging", DAY_0);

    await updateEnrollmentConcepts(db, ENROLLMENT_ID, concepts);
    const retrieved = await getEnrollmentConcepts(db, ENROLLMENT_ID);

    expect(retrieved.APIs.level).toBe("emerging");
    expect(retrieved.APIs.review_count).toBe(1);
  });
});

/* ---- Due-for-review detection ---- */

describe("Due-for-review detection", () => {
  it("concept NOT due before interval expires", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "emerging", DAY_0);

    const halfDay = addHours(DAY_0, 12);
    const due = getConceptsDueForReview(
      [{ section_id: "0.1", concepts_json: JSON.stringify(concepts) }],
      halfDay,
    );
    expect(due).toHaveLength(0);
  });

  it("concept IS due after interval expires", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "emerging", DAY_0);

    const day1 = addDays(DAY_0, 1);
    const due = getConceptsDueForReview(
      [{ section_id: "0.1", concepts_json: JSON.stringify(concepts) }],
      day1,
    );
    expect(due).toHaveLength(1);
    expect(due[0].concept).toBe("Servers");
    expect(due[0].days_overdue).toBe(0);
  });

  it("concepts sorted by most overdue first", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "emerging", DAY_0);
    concepts = updateConceptAssessment(concepts, "APIs", "developing", DAY_0);

    // At day 5: Servers is 4 days overdue (due day 1), APIs is 2 days overdue (due day 3)
    const day5 = addDays(DAY_0, 5);
    const due = getConceptsDueForReview(
      [{ section_id: "0.1", concepts_json: JSON.stringify(concepts) }],
      day5,
    );
    expect(due).toHaveLength(2);
    expect(due[0].concept).toBe("Servers"); // most overdue first
    expect(due[1].concept).toBe("APIs");
  });
});

/* ---- Review and upgrade ---- */

describe("Review and upgrade", () => {
  it("reviewing concept upgrades level and extends interval", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "emerging", DAY_0);

    // Review at day 1, upgrade to developing
    const day1 = addDays(DAY_0, 1);
    concepts = updateConceptAssessment(concepts, "Servers", "developing", day1);

    expect(concepts.Servers.level).toBe("developing");
    expect(concepts.Servers.review_count).toBe(2);

    // Next review should be day 1 + 3 days = day 4
    const nextReview = new Date(concepts.Servers.next_review);
    expect(nextReview.toISOString()).toBe(addDays(day1, 3).toISOString());
  });

  it("instruction halves the interval", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "solid", DAY_0, { needed_instruction: true });

    // Solid interval is 7 days, halved = 4 days (rounded)
    const nextReview = new Date(concepts.Servers.next_review);
    const expectedDays = 4; // Math.max(1, Math.round(7 * 0.5))
    expect(nextReview.toISOString()).toBe(addDays(DAY_0, expectedDays).toISOString());
    expect(concepts.Servers.needed_instruction).toBe(true);
  });
});

/* ---- Claim decay ---- */

describe("Claim decay from overdue concepts", () => {
  const CLAIMS = [
    makeClaim("claim-1", ["Servers"]),
    makeClaim("claim-2", ["APIs"]),
    makeClaim("claim-3", ["Databases"]),
  ];
  const MAP = makeLearningMap(CLAIMS);

  it("mildly overdue (2 days) -> claim downgraded one tier", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "developing", DAY_0);

    const claimsJson = JSON.stringify({ "claim-1": { level: "developing", timestamp: DAY_0.toISOString() } });
    const conceptsJson = JSON.stringify(concepts);

    // 2 days after next_review (due at day 3, check at day 5)
    const day5 = addDays(DAY_0, 5);
    const decayed = evaluateClaimDecay(claimsJson, conceptsJson, MAP, day5);

    expect(decayed["claim-1"]).toBeDefined();
    expect(decayed["claim-1"].level).toBe("emerging"); // downgraded from developing
  });

  it("severely overdue (7+ days) -> claim removed entirely", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "developing", DAY_0);

    const claimsJson = JSON.stringify({ "claim-1": { level: "developing", timestamp: DAY_0.toISOString() } });
    const conceptsJson = JSON.stringify(concepts);

    // 7 days after next_review (due at day 3, check at day 10)
    const day10 = addDays(DAY_0, 10);
    const decayed = evaluateClaimDecay(claimsJson, conceptsJson, MAP, day10);

    expect(decayed["claim-1"]).toBeUndefined(); // removed
  });

  it("concept NOT overdue -> claim unchanged", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "developing", DAY_0);

    const claimsJson = JSON.stringify({ "claim-1": { level: "developing", timestamp: DAY_0.toISOString() } });
    const conceptsJson = JSON.stringify(concepts);

    // Check at day 1, next_review is day 3 - not overdue yet
    const day1 = addDays(DAY_0, 1);
    const decayed = evaluateClaimDecay(claimsJson, conceptsJson, MAP, day1);

    expect(decayed["claim-1"].level).toBe("developing"); // unchanged
  });

  it("decay drops below threshold -> needs_review status", () => {
    // 3 claims, 2 demonstrated. If 1 decays, we have 1/3 = 33% < 70% threshold
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "developing", DAY_0);
    concepts = updateConceptAssessment(concepts, "APIs", "solid", DAY_0);

    const claimsJson = JSON.stringify({
      "claim-1": { level: "developing", timestamp: DAY_0.toISOString() },
      "claim-2": { level: "solid", timestamp: DAY_0.toISOString() },
    });
    const conceptsJson = JSON.stringify(concepts);

    // Servers overdue by 7+ days (due day 3, check day 11) -> claim-1 removed
    // APIs not overdue (due day 7, check day 11 = 4 days overdue -> downgrade)
    const day11 = addDays(DAY_0, 11);
    const decayed = evaluateClaimDecay(claimsJson, conceptsJson, MAP, day11);
    const progress = computeClaimProgress(JSON.stringify(decayed), MAP);

    expect(progress.meets_threshold).toBe(false);
  });
});

/* ---- Cross-section concept sharing ---- */

describe("Cross-section concept sharing via enrollment", () => {
  it("concept demonstrated in section 1 is visible from enrollment", async () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "developing", DAY_0);
    await updateEnrollmentConcepts(db, ENROLLMENT_ID, concepts);

    // Read back from enrollment (simulating section 3 context)
    const retrieved = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    expect(retrieved.Servers).toBeDefined();
    expect(retrieved.Servers.level).toBe("developing");
  });

  it("concepts from multiple sections accumulate in enrollment", async () => {
    let concepts: ConceptsMap = {};
    // Section 1 teaches Servers
    concepts = updateConceptAssessment(concepts, "Servers", "developing", DAY_0);
    await updateEnrollmentConcepts(db, ENROLLMENT_ID, concepts);

    // Section 2 teaches APIs (read existing, add new)
    const existing = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    const updated = updateConceptAssessment(existing, "APIs", "emerging", addDays(DAY_0, 2));
    await updateEnrollmentConcepts(db, ENROLLMENT_ID, updated);

    // Both present
    const final = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    expect(Object.keys(final)).toHaveLength(2);
    expect(final.Servers.level).toBe("developing");
    expect(final.APIs.level).toBe("emerging");
  });
});

/* ---- Staggered decay ---- */

describe("Staggered decay across multiple concepts", () => {
  it("3 concepts at different levels decay independently", () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "emerging", DAY_0);       // next_review: day 1
    concepts = updateConceptAssessment(concepts, "APIs", "developing", DAY_0);        // next_review: day 3
    concepts = updateConceptAssessment(concepts, "Databases", "solid", DAY_0);        // next_review: day 7

    const claims = [
      makeClaim("claim-1", ["Servers"]),
      makeClaim("claim-2", ["APIs"]),
      makeClaim("claim-3", ["Databases"]),
    ];
    const map = makeLearningMap(claims);

    const claimsJson = JSON.stringify({
      "claim-1": { level: "developing", timestamp: DAY_0.toISOString() },
      "claim-2": { level: "developing", timestamp: DAY_0.toISOString() },
      "claim-3": { level: "solid", timestamp: DAY_0.toISOString() },
    });
    const conceptsJson = JSON.stringify(concepts);

    // At day 5: Servers 4 days overdue (downgrade), APIs 2 days overdue (downgrade), Databases not overdue
    const day5 = addDays(DAY_0, 5);
    const decayed5 = evaluateClaimDecay(claimsJson, conceptsJson, map, day5);
    expect(decayed5["claim-1"].level).toBe("emerging");    // downgraded from developing
    expect(decayed5["claim-2"].level).toBe("emerging");    // downgraded from developing
    expect(decayed5["claim-3"].level).toBe("solid");       // unchanged

    // At day 10: Servers 9 days overdue (removed), APIs 7 days overdue (removed), Databases 3 days overdue (downgrade)
    const day10 = addDays(DAY_0, 10);
    const decayed10 = evaluateClaimDecay(claimsJson, conceptsJson, map, day10);
    expect(decayed10["claim-1"]).toBeUndefined();           // removed
    expect(decayed10["claim-2"]).toBeUndefined();           // removed
    expect(decayed10["claim-3"].level).toBe("developing");  // downgraded from solid
  });
});

/* ---- Review restores claims ---- */

describe("Review restores decayed claims", () => {
  it("refreshing concept removes the decay trigger", () => {
    const claims = [makeClaim("claim-1", ["Servers"])];
    const map = makeLearningMap(claims);

    // Initial state: concept at developing, claim at developing
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Servers", "developing", DAY_0);

    const claimsJson = JSON.stringify({
      "claim-1": { level: "developing", timestamp: DAY_0.toISOString() },
    });

    // Day 5: overdue -> decay happens
    const day5 = addDays(DAY_0, 5);
    const decayed = evaluateClaimDecay(claimsJson, JSON.stringify(concepts), map, day5);
    expect(decayed["claim-1"].level).toBe("emerging"); // decayed

    // Review at day 5: refresh concept
    concepts = updateConceptAssessment(concepts, "Servers", "developing", day5);

    // Day 5 after review: no longer overdue -> no decay
    const afterReview = evaluateClaimDecay(claimsJson, JSON.stringify(concepts), map, day5);
    expect(afterReview["claim-1"].level).toBe("developing"); // restored (original claims_json used)
  });
});

/* ---- Topic count ---- */

describe("Topic coverage count", () => {
  it("no concepts demonstrated: covered=0, total=N", () => {
    const map = makeLearningMap([
      makeClaim("c1", ["Servers"]),
      makeClaim("c2", ["APIs"]),
    ]);
    const result = countTopicsCovered({}, [map]);
    expect(result).toEqual({ covered: 0, total: 2 });
  });

  it("all concepts demonstrated: covered=total", () => {
    const map = makeLearningMap([
      makeClaim("c1", ["Servers"]),
      makeClaim("c2", ["APIs"]),
    ]);
    const concepts: ConceptsMap = {
      Servers: { level: "developing", last_reviewed: DAY_0.toISOString(), next_review: addDays(DAY_0, 3).toISOString(), review_count: 1 },
      APIs: { level: "emerging", last_reviewed: DAY_0.toISOString(), next_review: addDays(DAY_0, 1).toISOString(), review_count: 1 },
    };
    const result = countTopicsCovered(concepts, [map]);
    expect(result).toEqual({ covered: 2, total: 2 });
  });

  it("concept not in any map is excluded from both counts", () => {
    const map = makeLearningMap([makeClaim("c1", ["Servers"])]);
    const concepts: ConceptsMap = {
      Servers: { level: "developing", last_reviewed: DAY_0.toISOString(), next_review: addDays(DAY_0, 3).toISOString(), review_count: 1 },
      UnrelatedConcept: { level: "solid", last_reviewed: DAY_0.toISOString(), next_review: addDays(DAY_0, 7).toISOString(), review_count: 1 },
    };
    const result = countTopicsCovered(concepts, [map]);
    expect(result).toEqual({ covered: 1, total: 1 });
  });

  it("empty learning maps: {0, 0}", () => {
    const result = countTopicsCovered({}, []);
    expect(result).toEqual({ covered: 0, total: 0 });
  });

  it("concepts from multiple maps are deduplicated", () => {
    const map1 = makeLearningMap([makeClaim("c1", ["Servers", "APIs"])]);
    const map2 = makeLearningMap([makeClaim("c2", ["APIs", "Databases"])]);
    const concepts: ConceptsMap = {
      APIs: { level: "developing", last_reviewed: DAY_0.toISOString(), next_review: addDays(DAY_0, 3).toISOString(), review_count: 1 },
    };
    const result = countTopicsCovered(concepts, [map1, map2]);
    // Total unique: Servers, APIs, Databases = 3. Covered: APIs = 1
    expect(result).toEqual({ covered: 1, total: 3 });
  });
});

/* ---- Enrollment null/corrupt handling ---- */

describe("Enrollment concept edge cases", () => {
  it("null concepts_json returns empty map", async () => {
    const concepts = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    expect(concepts).toEqual({});
  });

  it("corrupt concepts_json returns empty map", async () => {
    sqliteDb.exec(`UPDATE enrollments SET concepts_json = 'not-json{{{' WHERE id = '${ENROLLMENT_ID}'`);
    const concepts = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    expect(concepts).toEqual({});
  });

  it("non-existent enrollment returns empty map", async () => {
    const concepts = await getEnrollmentConcepts(db, "nonexistent");
    expect(concepts).toEqual({});
  });
});
