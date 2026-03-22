import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  buildCurriculumContext,
  compressConversation,
  persistSummary,
  buildConversationContext,
} from "../context-assembly";
import { buildProgressContext } from "../../routes/curriculum-progress";
import { updateSectionProgress } from "../../routes/curriculum-progress";
import { mock } from "bun:test";

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

const TEST_LEARNER = "integration-learner-001";
const TEST_PROFILE = "level-1";
const TEST_SECTION = "1.1";

let sqliteDb: InstanceType<typeof Database>;
let db: D1Database;

beforeEach(() => {
  sqliteDb = new Database(":memory:");

  // Create tables matching the production schema
  sqliteDb.exec(`
    CREATE TABLE learners (
      id TEXT PRIMARY KEY,
      email TEXT,
      auth_provider TEXT NOT NULL,
      auth_subject TEXT NOT NULL
    );

    CREATE TABLE curriculum_conversations (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      archived_at TEXT,
      summary TEXT
    );

    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL REFERENCES learners(id),
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      understanding_json TEXT,
      concepts_json TEXT,
      claims_json TEXT DEFAULT '{}',
      started_at TEXT,
      completed_at TEXT,
      paused_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (learner_id, profile, section_id)
    );
  `);

  // Seed learner
  sqliteDb.exec(`INSERT INTO learners (id, email, auth_provider, auth_subject) VALUES ('${TEST_LEARNER}', 'test@test.com', 'github', 'sub1')`);

  db = createD1Shim(sqliteDb);
});

afterEach(() => {
  sqliteDb.close();
});

/* ---- Full context assembly with D1 progress data ---- */

describe("Full context assembly integration", () => {
  it("buildCurriculumContext produces valid output for real curriculum data", () => {
    const result = buildCurriculumContext(TEST_PROFILE, TEST_SECTION);
    expect(result).toContain("== Curriculum Content ==");
    expect(result).toContain("Current Section: 1.1");
    // Should have actual section content
    expect(result.length).toBeGreaterThan(100);
  });

  it("buildProgressContext includes concept mastery from progress data", async () => {
    // Insert progress with concept data
    const conceptsJson = JSON.stringify({
      "thread safety": {
        level: "solid",
        last_reviewed: "2025-01-01T00:00:00.000Z",
        next_review: "2025-01-08T00:00:00.000Z",
        review_count: 2,
      },
      "deadlocks": {
        level: "emerging",
        last_reviewed: "2025-01-01T00:00:00.000Z",
        next_review: "2025-01-02T00:00:00.000Z",
        review_count: 1,
        needed_instruction: true,
      },
    });

    sqliteDb.exec(`
      INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, updated_at)
      VALUES ('${TEST_LEARNER}', '${TEST_PROFILE}', '${TEST_SECTION}', 'in_progress',
              '[{"understanding_level":"developing"}]',
              '${conceptsJson.replace(/'/g, "''")}',
              datetime('now'))
    `);

    const result = await buildProgressContext(db, TEST_LEARNER, TEST_PROFILE);

    expect(result).toContain("== Learner Progress ==");
    expect(result).toContain("In progress:");
    expect(result).toContain("thread safety: solid");
    expect(result).toContain("deadlocks: emerging");
    expect(result).toContain("needed direct instruction");
  });

  it("buildProgressContext includes concepts due for spaced repetition", async () => {
    // Insert progress with an overdue concept
    const pastDate = new Date(Date.now() - 5 * 86_400_000).toISOString(); // 5 days ago
    const conceptsJson = JSON.stringify({
      "overdue-concept": {
        level: "emerging",
        last_reviewed: pastDate,
        next_review: pastDate, // already overdue
        review_count: 1,
      },
    });

    sqliteDb.exec(`
      INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, updated_at)
      VALUES ('${TEST_LEARNER}', '${TEST_PROFILE}', '${TEST_SECTION}', 'in_progress',
              '[]',
              '${conceptsJson.replace(/'/g, "''")}',
              datetime('now'))
    `);

    const result = await buildProgressContext(db, TEST_LEARNER, TEST_PROFILE);

    expect(result).toContain("== Concepts Due for Review ==");
    expect(result).toContain("overdue-concept");
    expect(result).toContain("days overdue");
  });
});

/* ---- Summary persistence round-trip ---- */

describe("Summary persistence round-trip", () => {
  it("persists and retrieves summary on a conversation row", async () => {
    // Insert a conversation
    sqliteDb.exec(`
      INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json)
      VALUES ('CONV001', '${TEST_LEARNER}', '${TEST_PROFILE}', '${TEST_SECTION}',
              '[{"role":"user","content":"hello"}]')
    `);

    // Persist a summary
    await persistSummary(db, "CONV001", "The learner explored basic concepts successfully.");

    // Verify it was stored
    const row = sqliteDb
      .prepare("SELECT summary FROM curriculum_conversations WHERE id = 'CONV001'")
      .get() as { summary: string };

    expect(row.summary).toBe("The learner explored basic concepts successfully.");
  });

  it("summary shows up in buildConversationContext", async () => {
    // Insert a conversation with summary
    sqliteDb.exec(`
      INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json, summary, archived_at)
      VALUES ('CONV002', '${TEST_LEARNER}', '${TEST_PROFILE}', '${TEST_SECTION}',
              '[{"role":"user","content":"hello"}]',
              'Previously discussed fundamentals of pilotry.',
              datetime('now'))
    `);

    const result = await buildConversationContext(db, TEST_LEARNER, TEST_PROFILE, TEST_SECTION);

    expect(result).toContain("== Prior Sessions ==");
    expect(result).toContain("Previously discussed fundamentals of pilotry.");
  });

  it("persistSummary updates existing conversation without affecting other fields", async () => {
    sqliteDb.exec(`
      INSERT INTO curriculum_conversations (id, learner_id, profile, section_id, messages_json)
      VALUES ('CONV003', '${TEST_LEARNER}', '${TEST_PROFILE}', '${TEST_SECTION}',
              '[{"role":"user","content":"test msg"}]')
    `);

    await persistSummary(db, "CONV003", "A brief summary.");

    const row = sqliteDb
      .prepare("SELECT messages_json, summary FROM curriculum_conversations WHERE id = 'CONV003'")
      .get() as { messages_json: string; summary: string };

    expect(row.messages_json).toContain("test msg");
    expect(row.summary).toBe("A brief summary.");
  });
});

/* ---- Extended progress context with spaced rep ---- */

describe("Extended progress context with concepts and spaced rep", () => {
  it("shows concept mastery for completed sections", async () => {
    const conceptsJson = JSON.stringify({
      "error handling": {
        level: "strong",
        last_reviewed: "2025-06-01T00:00:00.000Z",
        next_review: "2025-06-22T00:00:00.000Z",
        review_count: 3,
      },
    });

    sqliteDb.exec(`
      INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, completed_at, updated_at)
      VALUES ('${TEST_LEARNER}', '${TEST_PROFILE}', '${TEST_SECTION}', 'completed',
              '[{"understanding_level":"strong","final_understanding":"strong"}]',
              '${conceptsJson.replace(/'/g, "''")}',
              datetime('now'),
              datetime('now'))
    `);

    const result = await buildProgressContext(db, TEST_LEARNER, TEST_PROFILE);

    expect(result).toContain("Completed:");
    expect(result).toContain("error handling: strong");
  });

  it("returns empty string when no progress exists", async () => {
    const result = await buildProgressContext(db, TEST_LEARNER, TEST_PROFILE);
    expect(result).toBe("");
  });

  it("handles multiple sections with mixed statuses", async () => {
    // Section 1.1 completed
    sqliteDb.exec(`
      INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, updated_at)
      VALUES ('${TEST_LEARNER}', '${TEST_PROFILE}', '1.1', 'completed',
              '[{"understanding_level":"solid"}]',
              '{"concept-a":{"level":"solid","last_reviewed":"2025-01-01","next_review":"2025-12-01","review_count":1}}',
              datetime('now'))
    `);

    // Section 1.2 in progress
    sqliteDb.exec(`
      INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, updated_at)
      VALUES ('${TEST_LEARNER}', '${TEST_PROFILE}', '1.2', 'in_progress',
              '[{"understanding_level":"emerging"}]',
              '{"concept-b":{"level":"emerging","last_reviewed":"2025-01-01","next_review":"2025-01-02","review_count":1,"needed_instruction":true}}',
              datetime('now'))
    `);

    const result = await buildProgressContext(db, TEST_LEARNER, TEST_PROFILE);

    expect(result).toContain("Completed:");
    expect(result).toContain("In progress:");
    expect(result).toContain("concept-a: solid");
    expect(result).toContain("concept-b: emerging");
    expect(result).toContain("needed direct instruction");
  });
});
