import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  updateSectionProgress,
  getProgressForProfile,
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

  // Create curriculum_progress table
  sqliteDb.exec(`
    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      understanding_json TEXT DEFAULT '[]',
      started_at TEXT,
      completed_at TEXT,
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
  it("sets completed when tool_type is session_complete", async () => {
    // Start with regular interaction
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    // Then complete via session_complete
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "session_complete",
      final_understanding: "solid",
      concepts_covered: ["variables", "types", "scope"],
    });

    const row = sqliteDb
      .prepare(
        "SELECT status, completed_at, understanding_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
      )
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown>;

    expect(row.status).toBe("completed");
    expect(row.completed_at).toBeTruthy();

    const entries = JSON.parse(row.understanding_json as string);
    const sessionEntry = entries.find((e: Record<string, unknown>) => e.final_understanding);
    expect(sessionEntry).toBeTruthy();
    expect(sessionEntry.final_understanding).toBe("solid");
    expect(sessionEntry.concepts_covered).toEqual(["variables", "types", "scope"]);
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
