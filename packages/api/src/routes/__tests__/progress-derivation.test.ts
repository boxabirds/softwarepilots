import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { updateSectionProgress } from "../curriculum-progress";
import type { SocraticResponse } from "../curriculum-progress";

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

const TEST_LEARNER_ID = "test-learner-derivation";
const TEST_PROFILE = "foundations";
const TEST_SECTION = "3.1";

let sqliteDb: InstanceType<typeof Database>;
let db: D1Database;

function getRow() {
  return sqliteDb
    .prepare(
      "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?",
    )
    .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION) as Record<string, unknown> | undefined;
}

beforeEach(() => {
  sqliteDb = new Database(":memory:");

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
      "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)",
    )
    .run(TEST_LEARNER_ID, "derivation@example.com", "Derivation Tester", "github", "99999");

  db = createD1Shim(sqliteDb);
});

/* ---- Progress status derivation ---- */

describe("updateSectionProgress - status derivation", () => {
  it("first call creates in_progress status", async () => {
    const response: SocraticResponse = {};
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, response);

    const row = getRow();
    expect(row).toBeTruthy();
    expect(row!.status).toBe("in_progress");
    expect(row!.started_at).toBeTruthy();
  });

  it("accumulates confidence_assessment in understanding_json", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      confidence_assessment: "low",
    });

    const row = getRow();
    const entries = JSON.parse(row!.understanding_json as string);
    expect(entries).toHaveLength(1);
    expect(entries[0].confidence_assessment).toBe("low");
    expect(entries[0]).toHaveProperty("timestamp");
  });

  it("accumulates understanding_level in understanding_json", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      understanding_level: "emerging",
    });

    const row = getRow();
    const entries = JSON.parse(row!.understanding_json as string);
    expect(entries).toHaveLength(1);
    expect(entries[0].understanding_level).toBe("emerging");
  });

  it("sets completed when tool_type=surface_key_insight and learner_readiness=articulated", async () => {
    // Start with a regular interaction
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});

    // Then complete
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "surface_key_insight",
      learner_readiness: "articulated",
    });

    const row = getRow();
    expect(row!.status).toBe("completed");
    expect(row!.completed_at).toBeTruthy();
  });

  it("completed status never regresses to in_progress", async () => {
    // Complete the section
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      tool_type: "surface_key_insight",
      learner_readiness: "articulated",
    });
    expect(getRow()!.status).toBe("completed");

    // Regular interaction should not regress
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {});
    expect(getRow()!.status).toBe("completed");

    // Even with an assessment, status stays completed
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      understanding_level: "developing",
    });
    expect(getRow()!.status).toBe("completed");
  });

  it("multiple assessments are stored in order", async () => {
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      understanding_level: "emerging",
      confidence_assessment: "low",
    });

    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      understanding_level: "developing",
      confidence_assessment: "medium",
    });

    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION, {
      understanding_level: "solid",
      confidence_assessment: "high",
    });

    const row = getRow();
    const entries = JSON.parse(row!.understanding_json as string);
    expect(entries).toHaveLength(3);
    expect(entries[0].understanding_level).toBe("emerging");
    expect(entries[0].confidence_assessment).toBe("low");
    expect(entries[1].understanding_level).toBe("developing");
    expect(entries[1].confidence_assessment).toBe("medium");
    expect(entries[2].understanding_level).toBe("solid");
    expect(entries[2].confidence_assessment).toBe("high");
  });
});
