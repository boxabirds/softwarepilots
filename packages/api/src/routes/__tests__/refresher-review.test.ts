/**
 * Integration tests for refresher interstitial and review chat mode (Story 63).
 *
 * Tests the review-needed endpoint, review mode prompt building,
 * and concept restoration after review.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  updateConceptAssessment,
  parseConceptsJson,
} from "../../lib/spaced-repetition";
import type { ConceptsMap } from "../../lib/spaced-repetition";
import {
  getEnrollmentConcepts,
  updateEnrollmentConcepts,
} from "../../lib/enrollment-store";
import { evaluateClaimDecay, computeClaimProgress } from "../curriculum-progress";
import { buildReviewSystemPrompt } from "../socratic-chat";
import { TEST_REVIEW_PERSONA } from "./test-schema";
import type { SectionLearningMap, CurriculumMeta, SectionMeta, Claim } from "@softwarepilots/shared";

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

/* ---- Fixtures ---- */

const ENROLLMENT_ID = "enrollment-review-001";

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
    key_intuition_decomposition: [
      { id: "insight-1", statement: "Test insight", order: 1 },
      { id: "insight-2", statement: "Test insight 2", order: 2 },
    ],
  };
}

const TEST_META: CurriculumMeta = {
  profile: "level-0" as const,
  title: "Level 0",
  starting_position: "Beginner",
  tutor_guidance: "Use simple language.",
};

const TEST_SECTION: SectionMeta = {
  id: "0.1",
  module_id: "1",
  module_title: "Basics",
  title: "Systems Vocabulary",
  markdown: "## Vocab\n\n**Server**: a computer",
  key_intuition: "You cannot be accountable for something you cannot name.",
  concepts: ["Server", "Database"],
  learning_map: makeLearningMap([
    makeClaim("claim-1", ["Server"]),
    makeClaim("claim-2", ["Database"]),
    makeClaim("claim-3", ["Server", "Database"]),
  ]),
};

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
  sqliteDb.exec(`INSERT INTO enrollments (id, learner_id, profile, curriculum_version) VALUES ('${ENROLLMENT_ID}', 'learner-1', 'level-0', 1)`);
  db = createD1Shim(sqliteDb);
});

afterEach(() => { sqliteDb?.close(); });

/* ---- Review-needed logic ---- */

describe("Review-needed detection", () => {
  it("no concepts -> nothing due", async () => {
    const concepts = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    expect(Object.keys(concepts)).toHaveLength(0);
  });

  it("concepts not yet due -> nothing due", async () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Server", "developing", DAY_0);
    await updateEnrollmentConcepts(db, ENROLLMENT_ID, concepts);

    // Check at day 1 (next_review is day 3 for developing)
    const retrieved = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    const nextReview = new Date(retrieved.Server.next_review);
    const day1 = addDays(DAY_0, 1);
    expect(nextReview > day1).toBe(true);
  });

  it("overdue concepts detected from enrollment", async () => {
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Server", "emerging", DAY_0);
    concepts = updateConceptAssessment(concepts, "Database", "developing", DAY_0);
    await updateEnrollmentConcepts(db, ENROLLMENT_ID, concepts);

    // At day 5: Server is 4 days overdue (due day 1), Database is 2 days overdue (due day 3)
    const retrieved = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    const day5 = addDays(DAY_0, 5);
    const msPerDay = 86_400_000;

    let dueCount = 0;
    for (const [, assessment] of Object.entries(retrieved)) {
      if (new Date(assessment.next_review) <= day5) dueCount++;
    }
    expect(dueCount).toBe(2);
  });
});

/* ---- Review mode prompt ---- */

describe("Review mode prompt", () => {
  it("includes review session rules", () => {
    const prompt = buildReviewSystemPrompt(TEST_META, TEST_SECTION, [], TEST_REVIEW_PERSONA);
    expect(prompt).toContain("Review Session Rules");
    expect(prompt).toContain("PROBE FOR RECALL");
    expect(prompt).toContain("not teach new material");
  });

  it("includes section key intuition", () => {
    const prompt = buildReviewSystemPrompt(TEST_META, TEST_SECTION, [], TEST_REVIEW_PERSONA);
    expect(prompt).toContain(TEST_SECTION.key_intuition);
  });

  it("includes learning map claims for reference", () => {
    const prompt = buildReviewSystemPrompt(TEST_META, TEST_SECTION, [], TEST_REVIEW_PERSONA);
    expect(prompt).toContain("claim-1");
    expect(prompt).toContain("claim-2");
    expect(prompt).toContain("claim-3");
  });

  it("includes first message instructions when no conversation", () => {
    const prompt = buildReviewSystemPrompt(TEST_META, TEST_SECTION, [], TEST_REVIEW_PERSONA);
    expect(prompt).toContain("First Message");
    expect(prompt).toContain("greeting");
  });

  it("omits first message instructions when conversation exists", () => {
    const prompt = buildReviewSystemPrompt(TEST_META, TEST_SECTION, [
      { role: "user", content: "Hello" },
    ], TEST_REVIEW_PERSONA);
    expect(prompt).not.toContain("First Message");
  });

  it("includes progress context when provided", () => {
    const prompt = buildReviewSystemPrompt(TEST_META, TEST_SECTION, [], TEST_REVIEW_PERSONA, "Section 0.1: in_progress");
    expect(prompt).toContain("Learner Progress Context");
    expect(prompt).toContain("Section 0.1: in_progress");
  });

  it("instructs to keep session brief (2-5 exchanges)", () => {
    const prompt = buildReviewSystemPrompt(TEST_META, TEST_SECTION, [], TEST_REVIEW_PERSONA);
    expect(prompt).toContain("2-5 exchanges");
  });

  it("instructs to use track_concepts tool", () => {
    const prompt = buildReviewSystemPrompt(TEST_META, TEST_SECTION, [], TEST_REVIEW_PERSONA);
    expect(prompt).toContain("track_concepts");
  });
});

/* ---- Concept restoration after review ---- */

describe("Concept restoration after review", () => {
  it("refreshing overdue concept removes claim decay", async () => {
    const claims = [makeClaim("claim-1", ["Server"])];
    const map = makeLearningMap(claims);

    // Initial: concept at developing, claim at developing
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Server", "developing", DAY_0);
    await updateEnrollmentConcepts(db, ENROLLMENT_ID, concepts);

    const claimsJson = JSON.stringify({
      "claim-1": { level: "developing", timestamp: DAY_0.toISOString() },
    });

    // Day 5: concept overdue -> claim decayed
    const day5 = addDays(DAY_0, 5);
    const decayedBefore = evaluateClaimDecay(claimsJson, JSON.stringify(concepts), map, day5);
    expect(decayedBefore["claim-1"].level).toBe("emerging"); // decayed

    // Review at day 5: refresh concept
    concepts = updateConceptAssessment(concepts, "Server", "developing", day5);
    await updateEnrollmentConcepts(db, ENROLLMENT_ID, concepts);

    // After review: no longer overdue -> no decay
    const refreshedConcepts = await getEnrollmentConcepts(db, ENROLLMENT_ID);
    const decayedAfter = evaluateClaimDecay(claimsJson, JSON.stringify(refreshedConcepts), map, day5);
    expect(decayedAfter["claim-1"].level).toBe("developing"); // restored
  });

  it("review restores section progress above threshold", async () => {
    const claims = [
      makeClaim("claim-1", ["Server"]),
      makeClaim("claim-2", ["Database"]),
      makeClaim("claim-3", ["Server", "Database"]),
    ];
    const map = makeLearningMap(claims);

    // All 3 claims demonstrated
    let concepts: ConceptsMap = {};
    concepts = updateConceptAssessment(concepts, "Server", "developing", DAY_0);
    concepts = updateConceptAssessment(concepts, "Database", "solid", DAY_0);

    const claimsJson = JSON.stringify({
      "claim-1": { level: "developing", timestamp: DAY_0.toISOString() },
      "claim-2": { level: "solid", timestamp: DAY_0.toISOString() },
      "claim-3": { level: "developing", timestamp: DAY_0.toISOString() },
    });

    // Day 10: Server overdue by 7+ days -> claim-1 and claim-3 removed
    const day10 = addDays(DAY_0, 10);
    const decayed = evaluateClaimDecay(claimsJson, JSON.stringify(concepts), map, day10);
    const progressBefore = computeClaimProgress(JSON.stringify(decayed), map);
    expect(progressBefore.meets_threshold).toBe(false); // below 70%

    // Review: refresh both overdue concepts
    concepts = updateConceptAssessment(concepts, "Server", "developing", day10);
    concepts = updateConceptAssessment(concepts, "Database", "solid", day10);

    // After review: claims restored
    const afterReview = evaluateClaimDecay(claimsJson, JSON.stringify(concepts), map, day10);
    const progressAfter = computeClaimProgress(JSON.stringify(afterReview), map);
    expect(progressAfter.meets_threshold).toBe(true); // back above 70%
  });
});
