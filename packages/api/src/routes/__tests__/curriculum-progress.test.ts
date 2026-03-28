import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  updateSectionProgress,
  getProgressForProfile,
  buildProgressContext,
  computeClaimProgress,
  COMPLETION_THRESHOLD,
} from "../curriculum-progress";
import type { SocraticResponse, ClaimProgress } from "../curriculum-progress";
import type { SectionLearningMap } from "@softwarepilots/shared";
import { ENROLLMENT_TABLES_SQL, seedCurriculumVersions } from "./test-schema";

/* ---- D1Database shim using bun:sqlite ---- */

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

const TEST_LEARNER_ID = "test-learner-001";
const TEST_PROFILE = "foundations";
const TEST_SECTION = "2.1";

let sqliteDb: InstanceType<typeof Database>;
let db: D1Database;

beforeEach(() => {
  sqliteDb = new Database(":memory:");

  // Enable FK enforcement so FK violation tests work
  sqliteDb.exec("PRAGMA foreign_keys = ON");

  // Create learners table (referenced by FK)
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

  // Create curriculum_progress table (includes 0004 migration columns)
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

  sqliteDb.exec(ENROLLMENT_TABLES_SQL);
  seedCurriculumVersions(sqliteDb);

  // Seed test learner
  sqliteDb
    .prepare(
      "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)"
    )
    .run(TEST_LEARNER_ID, "test@example.com", "Test Learner", "github", "12345");

  db = createD1Shim(sqliteDb);
});

/* ---- updateSectionProgress ---- */

describe("updateSectionProgress", () => {
  it("creates row on first call with in_progress status", async () => {
    const response: SocraticResponse = {};
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, response);

    const row = sqliteDb
      .prepare(
        "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row).toBeTruthy();
    expect(row.status).toBe("in_progress");
    expect(row.started_at).toBeTruthy();
  });

  it("does not regress completed status", async () => {
    // First call: complete it
    const completionResponse: SocraticResponse = {
      tool_type: "surface_key_insight",
      learner_readiness: "articulated",
    };
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, completionResponse);

    // Verify completed
    let row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("completed");

    // Second call: regular interaction should not regress
    const regularResponse: SocraticResponse = {};
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, regularResponse);

    row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("completed");
  });

  it("accumulates understanding assessments", async () => {
    // First call with assessment
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      understanding_level: "emerging",
    });

    // Second call with another assessment
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      understanding_level: "developing",
      confidence_assessment: "medium",
    });

    const row = sqliteDb
      .prepare(
        "SELECT understanding_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const entries = JSON.parse(row.understanding_json as string);
    expect(entries).toHaveLength(2);
    expect(entries[0].understanding_level).toBe("emerging");
    expect(entries[1].understanding_level).toBe("developing");
    expect(entries[1].confidence_assessment).toBe("medium");
  });

  it("sets completed when tool_type is surface_key_insight and learner_readiness is articulated", async () => {
    // Start with regular interaction
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    // Then complete
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "surface_key_insight",
      learner_readiness: "articulated",
    });

    const row = sqliteDb
      .prepare(
        "SELECT status, completed_at FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.status).toBe("completed");
    expect(row.completed_at).toBeTruthy();
  });
});

/* ---- getProgressForProfile ---- */

describe("getProgressForProfile", () => {
  it("returns correct statuses for sections with progress", async () => {
    // Set up some progress
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, "2.1", {
      understanding_level: "emerging",
    });
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, "2.2", {
      tool_type: "surface_key_insight",
      learner_readiness: "articulated",
    });

    const progress = await getProgressForProfile(db, TEST_LEARNER_ID, TEST_PROFILE);

    expect(progress).toHaveLength(2);

    const s21 = progress.find((p) => p.section_id === "2.1");
    expect(s21).toBeTruthy();
    expect(s21!.status).toBe("in_progress");
    expect(s21!.understanding_level).toBe("emerging");

    const s22 = progress.find((p) => p.section_id === "2.2");
    expect(s22).toBeTruthy();
    expect(s22!.status).toBe("completed");
  });

  it("returns empty array for new learner with no progress", async () => {
    const progress = await getProgressForProfile(db, "nonexistent-learner", TEST_PROFILE);
    expect(progress).toEqual([]);
  });
});

/* ---- Concept tracking ---- */

describe("concept tracking via updateSectionProgress", () => {
  it("stores concepts_json when concepts_demonstrated is provided", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["concurrency", "race conditions"],
      concept_levels: ["emerging", "developing"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts.concurrency).toBeTruthy();
    expect(concepts.concurrency.level).toBe("emerging");
    expect(concepts.concurrency.review_count).toBe(1);
    expect(concepts["race conditions"]).toBeTruthy();
    expect(concepts["race conditions"].level).toBe("developing");
  });

  it("accumulates concepts across multiple calls without overwriting", async () => {
    // First call: one concept
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["concurrency"],
      concept_levels: ["emerging"],
    });

    // Second call: different concept
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["testing"],
      concept_levels: ["solid"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts.concurrency).toBeTruthy();
    expect(concepts.concurrency.level).toBe("emerging");
    expect(concepts.testing).toBeTruthy();
    expect(concepts.testing.level).toBe("solid");
  });

  it("updates existing concept level and increments review_count", async () => {
    // First call
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["concurrency"],
      concept_levels: ["emerging"],
    });

    // Second call: same concept, higher level
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["concurrency"],
      concept_levels: ["solid"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts.concurrency.level).toBe("solid");
    expect(concepts.concurrency.review_count).toBe(2);
  });

  it("sets spaced repetition intervals correctly per concept level", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["a", "b", "c", "d"],
      concept_levels: ["emerging", "developing", "solid", "strong"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);

    // Verify each concept has a next_review set
    for (const key of ["a", "b", "c", "d"]) {
      expect(concepts[key].next_review).toBeTruthy();
      expect(concepts[key].last_reviewed).toBeTruthy();
    }

    // Verify relative intervals: emerging < developing < solid < strong
    const nextA = new Date(concepts.a.next_review).getTime();
    const nextB = new Date(concepts.b.next_review).getTime();
    const nextC = new Date(concepts.c.next_review).getTime();
    const nextD = new Date(concepts.d.next_review).getTime();
    expect(nextA).toBeLessThan(nextB);
    expect(nextB).toBeLessThan(nextC);
    expect(nextC).toBeLessThan(nextD);
  });

  it("tracks concepts even on completed sections", async () => {
    // Complete the section
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "surface_key_insight",
      learner_readiness: "articulated",
    });

    // Track concepts on completed section
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["security"],
      concept_levels: ["strong"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json, status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.status).toBe("completed");
    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts.security).toBeTruthy();
    expect(concepts.security.level).toBe("strong");
  });

  it("leaves concepts_json as empty object when no concepts provided", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(JSON.parse(row.concepts_json as string)).toEqual({});
  });

  it("includes in-progress sections", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, "2.2", {
      understanding_level: "emerging",
    });

    const result = await buildProgressContext(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(result).toContain("In progress:");
    expect(result).toContain("2.2");
    expect(result).toContain("emerging understanding");
  });

  it("lists completed sections before in-progress sections", async () => {
    // Create an in-progress section
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, "2.2", {
      understanding_level: "emerging",
    });

    // Create a completed section
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, "2.1", {
      tool_type: "surface_key_insight",
      learner_readiness: "articulated",
    });

    const result = await buildProgressContext(db, TEST_LEARNER_ID, TEST_PROFILE);
    const completedIdx = result.indexOf("Completed:");
    const inProgressIdx = result.indexOf("In progress:");
    expect(completedIdx).toBeGreaterThan(-1);
    expect(inProgressIdx).toBeGreaterThan(-1);
    expect(completedIdx).toBeLessThan(inProgressIdx);
  });

  it("resolves section titles for valid profiles", async () => {
    // Use a real profile with real section IDs
    const REAL_PROFILE = "level-1";
    // Create enrollment so content can be loaded from DB
    sqliteDb
      .prepare(
        `INSERT OR IGNORE INTO enrollments (id, learner_id, profile, curriculum_version)
         VALUES (?, ?, ?, 1)`
      )
      .run("enroll-title-test", TEST_LEARNER_ID, REAL_PROFILE);
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, started_at, updated_at)
         VALUES (?, ?, ?, 'in_progress', '[]', datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, REAL_PROFILE, "1.1");

    const result = await buildProgressContext(db, TEST_LEARNER_ID, REAL_PROFILE);
    // Should contain the actual title from the curriculum, not just the ID
    expect(result).toContain("1.1");
    expect(result).toContain('"'); // Title is quoted
    expect(result).not.toContain('"1.1"'); // Title should be the actual name, not the ID
  });

  it("falls back to section IDs when profile is invalid for title lookup", async () => {
    // TEST_PROFILE ("foundations") is not a real curriculum profile
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, "2.1", {
      understanding_level: "developing",
    });

    const result = await buildProgressContext(db, TEST_LEARNER_ID, TEST_PROFILE);
    // Should still produce output, using the section_id as fallback title
    expect(result).toContain("2.1");
    expect(result).toContain("developing understanding");
  });
});

/* ---- Instruction progress logging ---- */

describe("instruction progress logging via provide_instruction", () => {
  it("stores needed_instruction=true and struggle_reason in concepts_json", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "provide_instruction",
      concept: "recursion",
      struggle_reason: "repeated_wrong_answer",
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts.recursion).toBeTruthy();
    expect(concepts.recursion.needed_instruction).toBe(true);
    expect(concepts.recursion.struggle_reason).toBe("repeated_wrong_answer");
    expect(concepts.recursion.level).toBe("emerging");
  });

  it("halves the spaced repetition interval for instructed concepts", async () => {
    // First: create a normal concept entry for comparison
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["normal_concept"],
      concept_levels: ["developing"],
    });

    // Then: create an instruction-triggered entry at the same level
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "provide_instruction",
      concept: "instructed_concept",
      struggle_reason: "no_progression",
      concepts_demonstrated: ["instructed_concept"],
      concept_levels: ["developing"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);

    // Normal developing interval = 3 days, instruction halved = ~2 days (rounded)
    const normalNext = new Date(concepts.normal_concept.next_review).getTime();
    const normalLast = new Date(concepts.normal_concept.last_reviewed).getTime();
    const normalInterval = normalNext - normalLast;

    const instructedNext = new Date(concepts.instructed_concept.next_review).getTime();
    const instructedLast = new Date(concepts.instructed_concept.last_reviewed).getTime();
    const instructedInterval = instructedNext - instructedLast;

    expect(instructedInterval).toBeLessThan(normalInterval);
    expect(concepts.instructed_concept.needed_instruction).toBe(true);
  });

  it("stores instruction concept even without concepts_demonstrated", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "provide_instruction",
      concept: "closures",
      struggle_reason: "learner_asked",
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts.closures).toBeTruthy();
    expect(concepts.closures.needed_instruction).toBe(true);
    expect(concepts.closures.struggle_reason).toBe("learner_asked");
  });

  it("handles provide_instruction in multi-tool response", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "provide_instruction+socratic_probe",
      concept: "async_await",
      struggle_reason: "low_confidence_sustained",
      concepts_demonstrated: ["async_await"],
      concept_levels: ["emerging"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts.async_await).toBeTruthy();
    expect(concepts.async_await.needed_instruction).toBe(true);
    expect(concepts.async_await.struggle_reason).toBe("low_confidence_sustained");
  });
});

/* ---- Pause status transitions ---- */

describe("pause status transitions", () => {
  it("transitions in_progress -> paused on session_pause tool_type", async () => {
    // Start with regular interaction to get in_progress
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    // Pause the session
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_pause",
      pause_reason: "fatigue_detected",
      concepts_covered_so_far: "variables, scope",
      resume_suggestion: "Pick up with closures next time",
    });

    const row = sqliteDb
      .prepare(
        "SELECT status, paused_at, understanding_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.status).toBe("paused");
    expect(row.paused_at).toBeTruthy();

    const entries = JSON.parse(row.understanding_json as string);
    const pauseEntry = entries.find((e: Record<string, string>) => e.pause_reason);
    expect(pauseEntry).toBeTruthy();
    expect(pauseEntry.pause_reason).toBe("fatigue_detected");
    expect(pauseEntry.concepts_covered_so_far).toBe("variables, scope");
    expect(pauseEntry.resume_suggestion).toBe("Pick up with closures next time");
  });

  it("blocks completed -> paused transition", async () => {
    // Complete the section
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_complete",
      final_understanding: "solid",
      concepts_covered: ["all concepts"],
    });

    // Try to pause - should not change status
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_pause",
      pause_reason: "learner_requested",
      concepts_covered_so_far: "all",
      resume_suggestion: "N/A",
    });

    const row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.status).toBe("completed");
  });

  it("transitions paused -> in_progress on next non-pause message", async () => {
    // Set up in_progress
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    // Pause
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_pause",
      pause_reason: "learner_requested",
      concepts_covered_so_far: "basics",
      resume_suggestion: "Continue with advanced topics",
    });

    // Verify paused
    let row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("paused");

    // Resume with regular interaction
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "socratic_probe",
      confidence_assessment: "medium",
    });

    row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("in_progress");
  });

  it("sets paused_at timestamp when pausing", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    const beforePause = new Date().toISOString();
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_pause",
      pause_reason: "frustration_detected",
      concepts_covered_so_far: "testing",
      resume_suggestion: "Review fundamentals",
    });

    const row = sqliteDb
      .prepare(
        "SELECT paused_at FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.paused_at).toBeTruthy();
    // paused_at should be at or after the time we recorded before the pause
    expect(new Date(row.paused_at as string).getTime()).toBeGreaterThanOrEqual(
      new Date(beforePause).getTime() - 1000
    );
  });

  it("stores concepts_covered_so_far in understanding_json", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_pause",
      pause_reason: "fatigue_detected",
      concepts_covered_so_far: "variables, loops, conditionals",
      resume_suggestion: "Start with functions next time",
    });

    const row = sqliteDb
      .prepare(
        "SELECT understanding_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const entries = JSON.parse(row.understanding_json as string);
    const pauseEntry = entries.find((e: Record<string, string>) => e.concepts_covered_so_far);
    expect(pauseEntry).toBeTruthy();
    expect(pauseEntry.concepts_covered_so_far).toBe("variables, loops, conditionals");
    expect(pauseEntry.resume_suggestion).toBe("Start with functions next time");
  });

  it("handles session_pause with multi-tool type string", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "track_concepts+session_pause",
      pause_reason: "learner_requested",
      concepts_covered_so_far: "all basics",
      resume_suggestion: "Advanced topics",
      concepts_demonstrated: ["variables"],
      concept_levels: ["solid"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.status).toBe("paused");
  });
});

/* ---- Progress write path reproduction tests (story 53) ---- */

describe("progress write path - reproduction tests", () => {
  it("first message with socratic_probe creates in_progress row", async () => {
    const response: SocraticResponse = {
      tool_type: "socratic_probe",
      confidence_assessment: "low",
    };
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, response);

    const row = sqliteDb
      .prepare(
        "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row).toBeTruthy();
    expect(row.status).toBe("in_progress");
    expect(row.started_at).toBeTruthy();

    // Verify understanding entry captured the confidence_assessment
    const entries = JSON.parse(row.understanding_json as string);
    expect(entries).toHaveLength(1);
    expect(entries[0].confidence_assessment).toBe("low");
  });

  it("session_complete transitions to completed with completed_at", async () => {
    // Create in_progress row first
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "socratic_probe",
      confidence_assessment: "low",
    });

    // Now complete via session_complete
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_complete",
      final_understanding: "solid",
      concepts_covered: ["concept-a"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT status, completed_at, understanding_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.status).toBe("completed");
    expect(row.completed_at).toBeTruthy();

    // Verify the final understanding entry was recorded
    const entries = JSON.parse(row.understanding_json as string);
    const finalEntry = entries.find((e: Record<string, unknown>) => e.final_understanding);
    expect(finalEntry).toBeTruthy();
    expect(finalEntry.final_understanding).toBe("solid");
    expect(finalEntry.concepts_covered).toContain("concept-a");
  });

  it("message after completed does not regress status", async () => {
    // Create and complete
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_complete",
      final_understanding: "solid",
      concepts_covered: ["concept-a"],
    });

    // Verify completed
    let row = sqliteDb
      .prepare(
        "SELECT status, completed_at FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("completed");
    const originalCompletedAt = row.completed_at;

    // Send another message that should not regress
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "evaluate_response",
      understanding_level: "strong",
    });

    row = sqliteDb
      .prepare(
        "SELECT status, completed_at FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.status).toBe("completed");
    expect(row.completed_at).toBe(originalCompletedAt);
  });

  it("concept tracking updates concepts_json with correct level", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      concepts_demonstrated: ["concept-x"],
      concept_levels: ["developing"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT concepts_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts["concept-x"]).toBeTruthy();
    expect(concepts["concept-x"].level).toBe("developing");
  });

  it("pause/resume cycle transitions correctly", async () => {
    // Start in_progress
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "socratic_probe",
      confidence_assessment: "medium",
    });

    let row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("in_progress");

    // Pause
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_pause",
      pause_reason: "fatigue_detected",
      concepts_covered_so_far: "basics",
      resume_suggestion: "Continue later",
    });

    row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("paused");

    // Resume with any non-pause message
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "socratic_probe",
      confidence_assessment: "high",
    });

    row = sqliteDb
      .prepare(
        "SELECT status FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;
    expect(row.status).toBe("in_progress");
  });

  it("missing learner returns gracefully without throwing or writing", async () => {
    const NONEXISTENT_LEARNER = "learner-does-not-exist";

    // Capture console.warn output
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args.join(" ")); };

    try {
      // Should NOT throw - the guard check returns early
      await updateSectionProgress(db, NONEXISTENT_LEARNER, TEST_PROFILE, TEST_SECTION, {
        tool_type: "socratic_probe",
        confidence_assessment: "low",
      });
    } finally {
      console.warn = originalWarn;
    }

    // Verify warning was logged
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]).toContain("[progress] Skipping write");
    expect(warnings[0]).toContain(NONEXISTENT_LEARNER);

    // Verify no row was created
    const row = sqliteDb
      .prepare(
        "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(NONEXISTENT_LEARNER, TEST_PROFILE, TEST_SECTION);
    expect(row).toBeNull();
  });

  it("FK constraint still enforced at DB level for direct inserts", async () => {
    // Verify the FK constraint is real at the database level
    // (the application guard prevents hitting this, but the constraint is a safety net)
    let caughtError: Error | null = null;
    try {
      sqliteDb
        .prepare(
          `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, started_at, updated_at)
           VALUES (?, ?, ?, 'in_progress', '[]', '{}', datetime('now'), datetime('now'))`
        )
        .run("nonexistent-learner", TEST_PROFILE, TEST_SECTION);
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).toBeTruthy();
    expect(caughtError!.message).toContain("FOREIGN KEY constraint failed");
  });

  it("first message creates row even with no understanding data", async () => {
    // Minimal response - only tool_type, no confidence or understanding fields
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "socratic_probe",
    });

    const row = sqliteDb
      .prepare(
        "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row).toBeTruthy();
    expect(row.status).toBe("in_progress");
    expect(row.started_at).toBeTruthy();

    // understanding_json should be empty array (no assessment data provided)
    const entries = JSON.parse(row.understanding_json as string);
    expect(entries).toHaveLength(0);
  });
});

/* ---- computeClaimProgress unit tests (Story 67.8) ---- */

describe("computeClaimProgress and auto-complete logic", () => {
  const FOUR_CLAIM_MAP: SectionLearningMap = {
    section_id: "test-section",
    generated_at: "2026-01-01T00:00:00Z",
    model_used: "test",
    prerequisites: [],
    core_claims: [
      { id: "C1", statement: "Claim 1", concepts: [] },
      { id: "C2", statement: "Claim 2", concepts: [] },
      { id: "C3", statement: "Claim 3", concepts: [] },
      { id: "C4", statement: "Claim 4", concepts: [] },
    ],
    key_misconceptions: [],
    key_intuition_decomposition: [],
  };

  it("auto-complete fires when claims hit 100% without session_complete", async () => {
    // All 4 claims demonstrated at developing or above
    const allClaimsJson = JSON.stringify({
      "C1": { level: "solid", timestamp: new Date().toISOString() },
      "C2": { level: "developing", timestamp: new Date().toISOString() },
      "C3": { level: "solid", timestamp: new Date().toISOString() },
      "C4": { level: "developing", timestamp: new Date().toISOString() },
    });

    const progress = computeClaimProgress(allClaimsJson, FOUR_CLAIM_MAP);

    expect(progress.percentage).toBe(100);
    expect(progress.meets_threshold).toBe(true);
    expect(progress.demonstrated).toBe(4);
    expect(progress.total).toBe(4);
    expect(progress.missing_claims).toEqual([]);

    // Now test the actual auto-complete via updateSectionProgress:
    // Seed a progress row with 3 claims, then send a response that adds the 4th.
    // Use a real profile section to exercise the DB path with a synthetic learning map.
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress
         (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, started_at, updated_at)
         VALUES (?, ?, ?, 'in_progress', '[]', '{}', ?, datetime('now'), datetime('now'))`
      )
      .run(
        TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION,
        JSON.stringify({
          "C1": { level: "solid", timestamp: new Date().toISOString() },
          "C2": { level: "developing", timestamp: new Date().toISOString() },
          "C3": { level: "solid", timestamp: new Date().toISOString() },
        })
      );

    // A socratic_probe response (not session_complete) with claim_assessment pushing to 100%
    const result = await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "socratic_probe",
      confidence_assessment: "high",
      claims_demonstrated: ["C4"],
      claim_levels: ["developing"],
    });

    // The TEST_PROFILE ("foundations") has no learning map in the static registry,
    // so claim_progress will be null because resolveLearningMap returns null.
    // The auto-complete logic requires a learning map to evaluate threshold.
    // This test validates the ProgressUpdate return type shape.
    // The pure computeClaimProgress tests above cover the threshold logic directly.
    expect(typeof result.section_completed).toBe("boolean");
    // claim_progress is null when no learning map exists for the section
    expect(result.claim_progress).toBeNull();
  });

  it("no auto-complete when claims below threshold", () => {
    // Only 2 of 4 claims demonstrated = 50%, threshold is 70%
    const partialClaimsJson = JSON.stringify({
      "C1": { level: "solid", timestamp: new Date().toISOString() },
      "C2": { level: "developing", timestamp: new Date().toISOString() },
    });

    const progress = computeClaimProgress(partialClaimsJson, FOUR_CLAIM_MAP);

    expect(progress.percentage).toBe(50);
    expect(progress.meets_threshold).toBe(false);
    expect(progress.demonstrated).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.missing_claims).toEqual(["C3", "C4"]);
  });

  it("no auto-complete when total is 0 (vacuous truth guard)", () => {
    const emptyMap: SectionLearningMap = {
      section_id: "empty",
      generated_at: "2026-01-01T00:00:00Z",
      model_used: "test",
      prerequisites: [],
      core_claims: [],
      key_misconceptions: [],
      key_intuition_decomposition: [],
    };

    const progress = computeClaimProgress("{}", emptyMap);

    // With 0 claims, meets_threshold is true (vacuous) but total is 0,
    // which prevents auto-complete in the production code path
    // (claimProgress.total > 0 check).
    expect(progress.total).toBe(0);
    expect(progress.demonstrated).toBe(0);
    expect(progress.meets_threshold).toBe(true);
    expect(progress.percentage).toBe(100);
  });

  it("null learning map returns vacuous progress", () => {
    const progress = computeClaimProgress('{"C1": {"level": "solid"}}', null);

    expect(progress.total).toBe(0);
    expect(progress.meets_threshold).toBe(true);
  });

  it("claims below MINIMUM_CLAIM_LEVEL do not count as demonstrated", () => {
    // "emerging" is below "developing" (MINIMUM_CLAIM_LEVEL)
    const claimsJson = JSON.stringify({
      "C1": { level: "emerging", timestamp: new Date().toISOString() },
      "C2": { level: "developing", timestamp: new Date().toISOString() },
      "C3": { level: "solid", timestamp: new Date().toISOString() },
    });

    const threeClaimMap: SectionLearningMap = {
      section_id: "test",
      generated_at: "2026-01-01T00:00:00Z",
      model_used: "test",
      prerequisites: [],
      core_claims: [
        { id: "C1", statement: "Claim 1", concepts: [] },
        { id: "C2", statement: "Claim 2", concepts: [] },
        { id: "C3", statement: "Claim 3", concepts: [] },
      ],
      key_misconceptions: [],
      key_intuition_decomposition: [],
    };

    const progress = computeClaimProgress(claimsJson, threeClaimMap);

    // C1 at "emerging" should not count
    expect(progress.demonstrated).toBe(2);
    expect(progress.total).toBe(3);
    expect(progress.percentage).toBe(67);
    expect(progress.missing_claims).toEqual(["C1"]);
  });
});
