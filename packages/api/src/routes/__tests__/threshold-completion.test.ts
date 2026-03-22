import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  computeClaimProgress,
  evaluateClaimDecay,
  updateSectionProgress,
  getProgressForProfile,
  COMPLETION_THRESHOLD,
  LEVEL_ORDER,
  STATUS_NEEDS_REVIEW,
} from "../curriculum-progress";
import type { SocraticResponse, ClaimsMap } from "../curriculum-progress";
import type { SectionLearningMap, Claim } from "@softwarepilots/shared";

/* ---- D1Database shim ---- */

function createD1Shim(sqliteDb: InstanceType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      let bindings: any[] = [];
      return {
        bind(...values: any[]) {
          bindings = values;
          return this;
        },
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
          return {
            results: rows,
            success: true,
            meta: {} as D1Result<T>["meta"],
          };
        },
        async run(): Promise<D1Response> {
          const stmt = sqliteDb.prepare(query);
          const info = stmt.run(...bindings);
          return {
            success: true,
            meta: {
              duration: 0,
              changes: info.changes,
              last_row_id: info.lastInsertRowid as number,
              changed_db: info.changes > 0,
              size_after: 0,
              rows_read: 0,
              rows_written: info.changes,
            },
          };
        },
      } as unknown as D1PreparedStatement;
    },
    async batch<T>(_stmts: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      throw new Error("batch not implemented in shim");
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error("dump not implemented in shim");
    },
    async exec(_query: string): Promise<D1ExecResult> {
      throw new Error("exec not implemented in shim");
    },
  } as unknown as D1Database;
}

/* ---- Test fixtures ---- */

const TEST_LEARNER_ID = "test-learner-threshold";
const TEST_PROFILE = "foundations";
const TEST_SECTION = "99.1";

function makeClaim(id: string, concepts: string[] = []): Claim {
  return {
    id,
    statement: `Claim ${id}`,
    concepts,
    demonstration_criteria: `Demonstrate ${id}`,
  };
}

function makeLearningMap(claims: Claim[]): SectionLearningMap {
  return {
    section_id: TEST_SECTION,
    generated_at: new Date().toISOString(),
    model_used: "test",
    prerequisites: [],
    core_claims: claims,
    key_misconceptions: [],
    key_intuition_decomposition: [],
  };
}

function makeClaimsJson(entries: Record<string, string>): string {
  const map: ClaimsMap = {};
  for (const [id, level] of Object.entries(entries)) {
    map[id] = { level, timestamp: new Date().toISOString() };
  }
  return JSON.stringify(map);
}

let sqliteDb: InstanceType<typeof Database>;
let db: D1Database;

beforeEach(() => {
  sqliteDb = new Database(":memory:");
  sqliteDb.exec("PRAGMA foreign_keys = ON");
  sqliteDb.exec(`
    CREATE TABLE learners (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT,
      auth_provider TEXT NOT NULL,
      auth_subject TEXT NOT NULL,
      enrolled_at TEXT DEFAULT (datetime('now')),
      last_active_at TEXT
    )
  `);
  sqliteDb.exec(`
    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      understanding_json TEXT DEFAULT '[]',
      concepts_json TEXT DEFAULT '{}',
      claims_json TEXT DEFAULT '{}',
      started_at TEXT,
      completed_at TEXT,
      paused_at TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (learner_id, profile, section_id)
    )
  `);
  sqliteDb
    .prepare(
      "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)"
    )
    .run(TEST_LEARNER_ID, "threshold@example.com", "Threshold Tester", "github", "77777");
  db = createD1Shim(sqliteDb);
});

/* ---- computeClaimProgress ---- */

describe("computeClaimProgress", () => {
  const SEVEN_CLAIMS = Array.from({ length: 7 }, (_, i) => makeClaim(`c${i + 1}`));
  const learningMap = makeLearningMap(SEVEN_CLAIMS);

  it("5/7 at developing = 71% meets threshold", () => {
    const claims = makeClaimsJson({
      c1: "developing",
      c2: "solid",
      c3: "developing",
      c4: "strong",
      c5: "developing",
    });
    const result = computeClaimProgress(claims, learningMap);
    expect(result.demonstrated).toBe(5);
    expect(result.total).toBe(7);
    expect(result.percentage).toBe(71);
    expect(result.meets_threshold).toBe(true);
    expect(result.missing_claims).toEqual(["c6", "c7"]);
  });

  it("4/7 at developing = 57% fails threshold", () => {
    const claims = makeClaimsJson({
      c1: "developing",
      c2: "developing",
      c3: "developing",
      c4: "developing",
    });
    const result = computeClaimProgress(claims, learningMap);
    expect(result.demonstrated).toBe(4);
    expect(result.total).toBe(7);
    expect(result.percentage).toBe(57);
    expect(result.meets_threshold).toBe(false);
  });

  it("claims at emerging do not count toward threshold", () => {
    const claims = makeClaimsJson({
      c1: "emerging",
      c2: "emerging",
      c3: "emerging",
      c4: "emerging",
      c5: "emerging",
      c6: "emerging",
      c7: "emerging",
    });
    const result = computeClaimProgress(claims, learningMap);
    expect(result.demonstrated).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.meets_threshold).toBe(false);
  });

  it("returns meets_threshold=true when no learning map exists", () => {
    const result = computeClaimProgress("{}", null);
    expect(result.meets_threshold).toBe(true);
    expect(result.total).toBe(0);
  });

  it("returns meets_threshold=true when learning map has no claims", () => {
    const emptyMap = makeLearningMap([]);
    const result = computeClaimProgress("{}", emptyMap);
    expect(result.meets_threshold).toBe(true);
    expect(result.total).toBe(0);
  });
});

/* ---- isCompletionTrigger (tested via updateSectionProgress) ---- */

describe("isCompletionTrigger with claim threshold", () => {
  // These tests use profile "foundations" which has no learning maps registered,
  // so threshold checks are bypassed. To test WITH threshold enforcement,
  // we'd need a real profile. Instead we verify via the core logic tested above.

  it("session_complete with no learning map completes normally (threshold bypassed)", async () => {
    const response: SocraticResponse = {
      tool_type: "session_complete",
      final_understanding: "solid",
    };
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, response);

    const row = sqliteDb
      .prepare("SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?")
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("completed");
  });

  it("surface_key_insight + articulated with no learning map completes normally", async () => {
    const response: SocraticResponse = {
      tool_type: "surface_key_insight",
      learner_readiness: "articulated",
    };
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, response);

    const row = sqliteDb
      .prepare("SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?")
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("completed");
  });

  it("threshold constants have expected values", () => {
    expect(COMPLETION_THRESHOLD).toBe(0.7);
    expect(LEVEL_ORDER.emerging).toBe(0);
    expect(LEVEL_ORDER.developing).toBe(1);
    expect(LEVEL_ORDER.solid).toBe(2);
    expect(LEVEL_ORDER.strong).toBe(3);
  });
});

/* ---- evaluateClaimDecay ---- */

describe("evaluateClaimDecay", () => {
  const now = new Date("2026-03-22T12:00:00Z");
  const msPerDay = 86_400_000;

  const claims: Claim[] = [
    makeClaim("c1", ["concept-a"]),
    makeClaim("c2", ["concept-b"]),
    makeClaim("c3", ["concept-c", "concept-d"]),
  ];
  const learningMap = makeLearningMap(claims);

  function makeConceptsJson(entries: Record<string, { level: string; nextReview: Date }>): string {
    const map: Record<string, { level: string; last_reviewed: string; next_review: string; review_count: number }> = {};
    for (const [name, entry] of Object.entries(entries)) {
      map[name] = {
        level: entry.level,
        last_reviewed: new Date(entry.nextReview.getTime() - msPerDay * 3).toISOString(),
        next_review: entry.nextReview.toISOString(),
        review_count: 1,
      };
    }
    return JSON.stringify(map);
  }

  it("concept 3 days overdue downgrades claim by one tier", () => {
    const claimsJson = makeClaimsJson({ c1: "solid", c2: "developing", c3: "strong" });
    const conceptsJson = makeConceptsJson({
      "concept-a": { level: "solid", nextReview: new Date(now.getTime() - msPerDay * 3) },
      "concept-b": { level: "developing", nextReview: new Date(now.getTime() + msPerDay) }, // not overdue
      "concept-c": { level: "solid", nextReview: new Date(now.getTime() + msPerDay) }, // not overdue
      "concept-d": { level: "strong", nextReview: new Date(now.getTime() + msPerDay) }, // not overdue
    });

    const result = evaluateClaimDecay(claimsJson, conceptsJson, learningMap, now);

    // c1 was solid, concept-a 3 days overdue -> downgrade to developing
    expect(result.c1.level).toBe("developing");
    // c2 unchanged (concept-b not overdue)
    expect(result.c2.level).toBe("developing");
    // c3 unchanged (concepts not overdue)
    expect(result.c3.level).toBe("strong");
  });

  it("concept 8 days overdue removes claim entirely", () => {
    const claimsJson = makeClaimsJson({ c1: "solid", c2: "developing" });
    const conceptsJson = makeConceptsJson({
      "concept-a": { level: "solid", nextReview: new Date(now.getTime() - msPerDay * 8) },
      "concept-b": { level: "developing", nextReview: new Date(now.getTime() + msPerDay) },
    });

    const result = evaluateClaimDecay(claimsJson, conceptsJson, learningMap, now);

    // c1 removed (concept-a 8 days overdue)
    expect(result.c1).toBeUndefined();
    // c2 unchanged
    expect(result.c2.level).toBe("developing");
  });

  it("emerging claim downgraded removes it (no tier below emerging)", () => {
    const claimsJson = makeClaimsJson({ c1: "emerging" });
    const conceptsJson = makeConceptsJson({
      "concept-a": { level: "emerging", nextReview: new Date(now.getTime() - msPerDay * 3) },
    });

    const result = evaluateClaimDecay(claimsJson, conceptsJson, learningMap, now);

    // emerging downgraded has no lower tier, so removed
    expect(result.c1).toBeUndefined();
  });

  it("no decay when concepts are not overdue", () => {
    const claimsJson = makeClaimsJson({ c1: "solid", c2: "developing" });
    const conceptsJson = makeConceptsJson({
      "concept-a": { level: "solid", nextReview: new Date(now.getTime() + msPerDay * 5) },
      "concept-b": { level: "developing", nextReview: new Date(now.getTime() + msPerDay) },
    });

    const result = evaluateClaimDecay(claimsJson, conceptsJson, learningMap, now);

    expect(result.c1.level).toBe("solid");
    expect(result.c2.level).toBe("developing");
  });

  it("returns empty map for null inputs", () => {
    const result = evaluateClaimDecay(null, null, learningMap, now);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

/* ---- needs_review status via getProgressForProfile ---- */

describe("completed section with decayed claims reports as needs_review", () => {
  // Note: getProgressForProfile uses getLearningMapForProfile which requires a real profile.
  // For profile "foundations" there are no maps, so decay won't trigger.
  // We test the decay logic directly via computeClaimProgress + evaluateClaimDecay above,
  // and verify the getProgressForProfile integration returns correct structure.

  it("getProgressForProfile returns claim_progress when present", async () => {
    // Insert a completed row
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, completed_at, updated_at)
         VALUES (?, ?, ?, 'completed', '[]', '{}', '{}', datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION);

    const results = await getProgressForProfile(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(results).toHaveLength(1);
    expect(results[0].section_id).toBe(TEST_SECTION);
    // No learning map for "foundations" profile, so no claim_progress
    expect(results[0].claim_progress).toBeUndefined();
    expect(results[0].status).toBe("completed");
  });

  it("needs_review status constant is defined", () => {
    expect(STATUS_NEEDS_REVIEW).toBe("needs_review");
  });
});

/* ---- API response structure ---- */

describe("API response includes claim_progress", () => {
  it("getProgressForProfile returns status and section_id for each row", async () => {
    // Create two sections
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, updated_at)
         VALUES (?, ?, ?, 'in_progress', '[{"understanding_level":"emerging"}]', '{}', '{}', datetime('now'))`
      )
      .run(TEST_LEARNER_ID, TEST_PROFILE, "1.1");

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, completed_at, updated_at)
         VALUES (?, ?, ?, 'completed', '[{"understanding_level":"solid"}]', '{}', '{}', datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, TEST_PROFILE, "1.2");

    const results = await getProgressForProfile(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.section_id).sort()).toEqual(["1.1", "1.2"]);
    expect(results.find((r) => r.section_id === "1.1")?.status).toBe("in_progress");
    expect(results.find((r) => r.section_id === "1.2")?.status).toBe("completed");
  });
});

/* ---- Integration: getProgressForProfile with real learning maps ---- */

/**
 * These tests use profile "level-1" section "1.1" which has a real learning map
 * with 4 core claims (claim-1..claim-4). The 70% threshold means 3/4 demonstrated
 * claims are needed. Each claim maps to concepts that drive spaced-repetition decay.
 */
describe("getProgressForProfile with real learning maps (level-1:1.1)", () => {
  const REAL_PROFILE = "level-1";
  const REAL_SECTION = "1.1";
  const MS_PER_DAY = 86_400_000;

  /** Build a claims_json with given claim levels */
  function buildClaimsJson(entries: Record<string, string>): string {
    const map: Record<string, { level: string; timestamp: string }> = {};
    for (const [id, level] of Object.entries(entries)) {
      map[id] = { level, timestamp: new Date().toISOString() };
    }
    return JSON.stringify(map);
  }

  /** Build a concepts_json with specific next_review dates */
  function buildConceptsJson(
    entries: Record<string, { level: string; nextReview: Date }>
  ): string {
    const map: Record<string, {
      level: string;
      last_reviewed: string;
      next_review: string;
      review_count: number;
    }> = {};
    for (const [name, entry] of Object.entries(entries)) {
      map[name] = {
        level: entry.level,
        last_reviewed: new Date(entry.nextReview.getTime() - MS_PER_DAY * 3).toISOString(),
        next_review: entry.nextReview.toISOString(),
        review_count: 1,
      };
    }
    return JSON.stringify(map);
  }

  it("returns claim_progress with demonstrated/total/percentage for section with claim data", async () => {
    // 3 of 4 claims demonstrated at developing or above
    const claimsJson = buildClaimsJson({
      "claim-1": "solid",
      "claim-2": "developing",
      "claim-3": "strong",
    });

    // Concepts not overdue (far future next_review)
    const futureDate = new Date(Date.now() + MS_PER_DAY * 30);
    const conceptsJson = buildConceptsJson({
      "The gap between \"works\" and \"correct\"": { level: "solid", nextReview: futureDate },
      "Concurrency - the agent's blind spot": { level: "developing", nextReview: futureDate },
      "Memory and resource management": { level: "strong", nextReview: futureDate },
    });

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress
         (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, completed_at, updated_at)
         VALUES (?, ?, ?, 'completed', '[{"understanding_level":"solid"}]', ?, ?, datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, REAL_PROFILE, REAL_SECTION, conceptsJson, claimsJson);

    const results = await getProgressForProfile(db, TEST_LEARNER_ID, REAL_PROFILE);
    expect(results).toHaveLength(1);

    const section = results[0];
    expect(section.section_id).toBe(REAL_SECTION);
    expect(section.status).toBe("completed");
    expect(section.claim_progress).toBeDefined();
    expect(section.claim_progress!.demonstrated).toBe(3);
    expect(section.claim_progress!.total).toBe(4);
    expect(section.claim_progress!.percentage).toBe(75);
    expect(section.claim_progress!.missing).toEqual(["claim-4"]);
  });

  it("completed section with overdue concepts returns needs_review via decay", async () => {
    // All 4 claims demonstrated (meets threshold normally)
    const claimsJson = buildClaimsJson({
      "claim-1": "developing",
      "claim-2": "developing",
      "claim-3": "developing",
      "claim-4": "developing",
    });

    // Make concepts heavily overdue (8+ days) so claims decay away entirely.
    // claim-1 ties to "The gap between works and correct" and "Concurrency" and "Memory"
    // claim-2 ties to "Concurrency"
    // claim-3 ties to "Memory and resource management"
    // claim-4 ties to "The gap between works and correct"
    // Making all concepts 8 days overdue will remove all claims, dropping to 0%.
    const overdueDate = new Date(Date.now() - MS_PER_DAY * 8);
    const conceptsJson = buildConceptsJson({
      "The gap between \"works\" and \"correct\"": { level: "developing", nextReview: overdueDate },
      "Concurrency - the agent's blind spot": { level: "developing", nextReview: overdueDate },
      "Memory and resource management": { level: "developing", nextReview: overdueDate },
    });

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress
         (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, completed_at, updated_at)
         VALUES (?, ?, ?, 'completed', '[{"understanding_level":"solid"}]', ?, ?, datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, REAL_PROFILE, REAL_SECTION, conceptsJson, claimsJson);

    const results = await getProgressForProfile(db, TEST_LEARNER_ID, REAL_PROFILE);
    expect(results).toHaveLength(1);

    const section = results[0];
    expect(section.section_id).toBe(REAL_SECTION);
    expect(section.status).toBe(STATUS_NEEDS_REVIEW);
    // Decayed claims should show reduced progress
    expect(section.claim_progress).toBeDefined();
    expect(section.claim_progress!.percentage).toBeLessThan(70);
  });

  it("needs_review section returns to completed when claims are re-demonstrated", async () => {
    // Start with all 4 claims demonstrated, but concepts overdue so decay triggers needs_review
    const claimsJson = buildClaimsJson({
      "claim-1": "developing",
      "claim-2": "developing",
      "claim-3": "developing",
      "claim-4": "developing",
    });

    const overdueDate = new Date(Date.now() - MS_PER_DAY * 8);
    const conceptsJson = buildConceptsJson({
      "The gap between \"works\" and \"correct\"": { level: "developing", nextReview: overdueDate },
      "Concurrency - the agent's blind spot": { level: "developing", nextReview: overdueDate },
      "Memory and resource management": { level: "developing", nextReview: overdueDate },
    });

    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress
         (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, completed_at, updated_at)
         VALUES (?, ?, ?, 'completed', '[{"understanding_level":"solid"}]', ?, ?, datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, REAL_PROFILE, REAL_SECTION, conceptsJson, claimsJson);

    // Verify it starts as needs_review due to decay
    const beforeResults = await getProgressForProfile(db, TEST_LEARNER_ID, REAL_PROFILE);
    expect(beforeResults[0].status).toBe(STATUS_NEEDS_REVIEW);

    // Now "re-demonstrate" by updating concepts to have future next_review dates.
    // This simulates the learner doing a review session that refreshes the concepts.
    const futureDate = new Date(Date.now() + MS_PER_DAY * 30);
    const freshConceptsJson = buildConceptsJson({
      "The gap between \"works\" and \"correct\"": { level: "solid", nextReview: futureDate },
      "Concurrency - the agent's blind spot": { level: "solid", nextReview: futureDate },
      "Memory and resource management": { level: "solid", nextReview: futureDate },
    });

    sqliteDb
      .prepare(
        `UPDATE curriculum_progress SET concepts_json = ?, updated_at = datetime('now')
         WHERE learner_id = ? AND profile = ? AND section_id = ?`
      )
      .run(freshConceptsJson, TEST_LEARNER_ID, REAL_PROFILE, REAL_SECTION);

    // Now getProgressForProfile should return completed (decay no longer triggers)
    const afterResults = await getProgressForProfile(db, TEST_LEARNER_ID, REAL_PROFILE);
    expect(afterResults).toHaveLength(1);
    expect(afterResults[0].status).toBe("completed");
    expect(afterResults[0].claim_progress).toBeDefined();
    expect(afterResults[0].claim_progress!.percentage).toBeGreaterThanOrEqual(70);
  });
});
