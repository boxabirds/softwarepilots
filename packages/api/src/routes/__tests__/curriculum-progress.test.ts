import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  updateSectionProgress,
  getProgressForProfile,
  buildProgressContext,
} from "../curriculum-progress";
import type { SocraticResponse } from "../curriculum-progress";

/* ---- D1Database shim using better-sqlite3 ---- */

function createD1Shim(sqliteDb: ReturnType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) {
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
  } as D1Database;
}

/* ---- Test fixtures ---- */

const TEST_LEARNER_ID = "test-learner-001";
const TEST_PROFILE = "foundations";
const TEST_SECTION = "2.1";

let sqliteDb: ReturnType<typeof Database>;
let db: D1Database;

beforeEach(() => {
  sqliteDb = new Database(":memory:");

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
      started_at TEXT,
      completed_at TEXT,
      paused_at TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (learner_id, profile, section_id)
    )
  `);

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
    const REAL_PROFILE = "new-grad";
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
