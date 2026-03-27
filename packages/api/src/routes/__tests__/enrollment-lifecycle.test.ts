/**
 * Integration tests for enrollment and curriculum version lifecycle (Story 60).
 *
 * Uses in-memory SQLite via D1 shim. Tests enrollment creation, version pinning,
 * version publishing, and the seed migration path.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { getOrCreateEnrollment, getEnrollment } from "../../lib/enrollment-store";
import {
  publishVersion,
  getCurrentVersion,
  loadCurriculumByVersion,
  loadCurriculumForEnrollment,
  getVersionHistory,
  getVersionContentHash,
} from "../../lib/curriculum-store";

/* ---- D1 shim ---- */

function createD1Shim(sqliteDb: InstanceType<typeof Database>): D1Database {
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
  } as unknown as D1Database;
}

/* ---- Test fixtures ---- */

const TEST_LEARNER_ID = "test-learner-001";
const TEST_LEARNER_2 = "test-learner-002";
const TEST_PROFILE = "level-0";

const SAMPLE_CURRICULUM = JSON.stringify({
  meta: { profile: "level-0", title: "Level 0", starting_position: "Beginner", tutor_guidance: "Simple language" },
  modules: [{
    id: "1",
    title: "Basics",
    sections: [{ id: "0.1", title: "Vocab", key_intuition: "Name things", markdown: "## Vocab\n\n**Server**: a computer" }],
  }],
});
const SAMPLE_HASH = "abc123hash";

const UPDATED_CURRICULUM = JSON.stringify({
  meta: { profile: "level-0", title: "Level 0 v2", starting_position: "Beginner", tutor_guidance: "Updated guidance" },
  modules: [{
    id: "1",
    title: "Basics v2",
    sections: [{ id: "0.1", title: "Vocab v2", key_intuition: "Name things v2", markdown: "## Vocab v2\n\nUpdated content" }],
  }],
});
const UPDATED_HASH = "def456hash";

/* ---- Setup ---- */

let sqliteDb: InstanceType<typeof Database>;
let db: D1Database;

beforeEach(() => {
  sqliteDb = new Database(":memory:");
  sqliteDb.exec("PRAGMA foreign_keys = OFF"); // Simplify test setup

  // Create tables
  sqliteDb.exec(`
    CREATE TABLE learners (
      id TEXT PRIMARY KEY,
      display_name TEXT
    );
    CREATE TABLE curriculum_versions (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      profile TEXT NOT NULL,
      version INTEGER NOT NULL,
      content_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      created_by TEXT,
      reason TEXT,
      UNIQUE (profile, version)
    );
    CREATE INDEX idx_cv_current ON curriculum_versions(profile) WHERE deleted = 0;
    CREATE TABLE enrollments (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL,
      profile TEXT NOT NULL,
      curriculum_version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      enrolled_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (learner_id, profile)
    );
    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL,
      profile TEXT NOT NULL,
      section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      understanding_json TEXT,
      started_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (learner_id, profile, section_id)
    );
  `);

  // Seed test learners
  sqliteDb.exec(`INSERT INTO learners (id, display_name) VALUES ('${TEST_LEARNER_ID}', 'Test Learner')`);
  sqliteDb.exec(`INSERT INTO learners (id, display_name) VALUES ('${TEST_LEARNER_2}', 'Test Learner 2')`);

  db = createD1Shim(sqliteDb);
});

afterEach(() => {
  sqliteDb?.close();
});

/* ---- Enrollment creation ---- */

describe("Enrollment creation", () => {
  it("creates enrollment with version 1 when no versions exist (fallback)", async () => {
    const enrollment = await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(enrollment.learner_id).toBe(TEST_LEARNER_ID);
    expect(enrollment.profile).toBe(TEST_PROFILE);
    expect(enrollment.curriculum_version).toBe(1);
    expect(enrollment.status).toBe("active");
  });

  it("creates enrollment pinned to latest published version", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH, "admin", "v1");
    await publishVersion(db, TEST_PROFILE, UPDATED_CURRICULUM, UPDATED_HASH, "admin", "v2");

    const enrollment = await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(enrollment.curriculum_version).toBe(2);
  });

  it("returns existing enrollment on second call (idempotent)", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);

    const first = await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    const second = await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);

    expect(first.id).toBe(second.id);
    expect(first.curriculum_version).toBe(second.curriculum_version);
  });

  it("getEnrollment returns null when not enrolled", async () => {
    const result = await getEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(result).toBeNull();
  });

  it("getEnrollment returns enrollment after creation", async () => {
    await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    const result = await getEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(result).not.toBeNull();
    expect(result!.learner_id).toBe(TEST_LEARNER_ID);
  });
});

/* ---- Version pinning ---- */

describe("Version pinning", () => {
  it("existing learner stays on v1 after v2 is published", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);
    await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);

    // Publish v2
    await publishVersion(db, TEST_PROFILE, UPDATED_CURRICULUM, UPDATED_HASH);

    // Existing enrollment unchanged
    const enrollment = await getEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(enrollment!.curriculum_version).toBe(1);
  });

  it("new learner after v2 gets v2", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);
    await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE); // pinned to v1

    await publishVersion(db, TEST_PROFILE, UPDATED_CURRICULUM, UPDATED_HASH);
    const newEnrollment = await getOrCreateEnrollment(db, TEST_LEARNER_2, TEST_PROFILE);
    expect(newEnrollment.curriculum_version).toBe(2);
  });

  it("loadCurriculumForEnrollment returns pinned version content", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);
    await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);

    await publishVersion(db, TEST_PROFILE, UPDATED_CURRICULUM, UPDATED_HASH);

    const versioned = await loadCurriculumForEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(versioned).not.toBeNull();
    expect(versioned!.version).toBe(1);
    expect(versioned!.content.meta.title).toBe("Level 0");
  });

  it("loadCurriculumForEnrollment returns null for non-enrolled learner", async () => {
    const result = await loadCurriculumForEnrollment(db, "nobody", TEST_PROFILE);
    expect(result).toBeNull();
  });
});

/* ---- Version lifecycle ---- */

describe("Version lifecycle", () => {
  it("first publish creates version 1", async () => {
    const v = await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH, "admin", "Initial");
    expect(v.version).toBe(1);
    expect(v.profile).toBe(TEST_PROFILE);
    expect(v.created_by).toBe("admin");
    expect(v.reason).toBe("Initial");
  });

  it("second publish creates version 2 and soft-deletes version 1", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);
    const v2 = await publishVersion(db, TEST_PROFILE, UPDATED_CURRICULUM, UPDATED_HASH);
    expect(v2.version).toBe(2);

    // v1 should be soft-deleted
    const history = await getVersionHistory(db, TEST_PROFILE);
    expect(history).toHaveLength(2);
    const v1 = history.find((h) => h.version === 1);
    expect(v1!.deleted).toBe(1);
    const v2hist = history.find((h) => h.version === 2);
    expect(v2hist!.deleted).toBe(0);
  });

  it("getCurrentVersion returns latest non-deleted version", async () => {
    expect(await getCurrentVersion(db, TEST_PROFILE)).toBeNull();

    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);
    expect(await getCurrentVersion(db, TEST_PROFILE)).toBe(1);

    await publishVersion(db, TEST_PROFILE, UPDATED_CURRICULUM, UPDATED_HASH);
    expect(await getCurrentVersion(db, TEST_PROFILE)).toBe(2);
  });

  it("version history returns all versions ordered DESC", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH, "a", "r1");
    await publishVersion(db, TEST_PROFILE, UPDATED_CURRICULUM, UPDATED_HASH, "b", "r2");

    const history = await getVersionHistory(db, TEST_PROFILE);
    expect(history).toHaveLength(2);
    expect(history[0].version).toBe(2);
    expect(history[1].version).toBe(1);
    expect(history[0].created_by).toBe("b");
    expect(history[1].created_by).toBe("a");
  });

  it("loadCurriculumByVersion deserializes content correctly", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);

    const v = await loadCurriculumByVersion(db, TEST_PROFILE, 1);
    expect(v).not.toBeNull();
    expect(v!.content.meta.profile).toBe("level-0");
    expect(v!.content.modules).toHaveLength(1);
    expect(v!.content.modules[0].sections[0].id).toBe("0.1");
  });

  it("loadCurriculumByVersion returns null for non-existent version", async () => {
    const result = await loadCurriculumByVersion(db, TEST_PROFILE, 99);
    expect(result).toBeNull();
  });

  it("getVersionContentHash returns hash for existing version", async () => {
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);
    const hash = await getVersionContentHash(db, TEST_PROFILE, 1);
    expect(hash).toBe(SAMPLE_HASH);
  });

  it("getVersionContentHash returns null for non-existent version", async () => {
    const hash = await getVersionContentHash(db, TEST_PROFILE, 99);
    expect(hash).toBeNull();
  });
});

/* ---- Seed migration path ---- */

describe("Seed migration path", () => {
  it("backfill creates enrollments for learners with progress", async () => {
    // Simulate existing progress data
    sqliteDb.exec(`INSERT INTO curriculum_progress (learner_id, profile, section_id, status) VALUES ('${TEST_LEARNER_ID}', '${TEST_PROFILE}', '0.1', 'in_progress')`);
    sqliteDb.exec(`INSERT INTO curriculum_progress (learner_id, profile, section_id, status) VALUES ('${TEST_LEARNER_ID}', '${TEST_PROFILE}', '0.2', 'completed')`);

    // Seed version
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH, "seed", "Initial seed");

    // Backfill enrollment (simulating what the seed script does)
    await db.prepare(
      `INSERT OR IGNORE INTO enrollments (id, learner_id, profile, curriculum_version)
       SELECT hex(randomblob(16)), learner_id, profile, 1
       FROM (SELECT DISTINCT learner_id, profile FROM curriculum_progress)`
    ).run();

    const enrollment = await getEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(enrollment).not.toBeNull();
    expect(enrollment!.curriculum_version).toBe(1);
  });

  it("backfill is idempotent (no duplicates on re-run)", async () => {
    sqliteDb.exec(`INSERT INTO curriculum_progress (learner_id, profile, section_id, status) VALUES ('${TEST_LEARNER_ID}', '${TEST_PROFILE}', '0.1', 'in_progress')`);
    await publishVersion(db, TEST_PROFILE, SAMPLE_CURRICULUM, SAMPLE_HASH);

    // Run backfill twice
    const backfillSql = `INSERT OR IGNORE INTO enrollments (id, learner_id, profile, curriculum_version)
       SELECT hex(randomblob(16)), learner_id, profile, 1
       FROM (SELECT DISTINCT learner_id, profile FROM curriculum_progress)`;

    await db.prepare(backfillSql).run();
    await db.prepare(backfillSql).run();

    // Should have exactly one enrollment
    const { results } = await db.prepare(
      "SELECT * FROM enrollments WHERE learner_id = ? AND profile = ?"
    ).bind(TEST_LEARNER_ID, TEST_PROFILE).all();
    expect(results).toHaveLength(1);
  });

  it("learner with progress in multiple profiles gets one enrollment per profile", async () => {
    sqliteDb.exec(`INSERT INTO curriculum_progress (learner_id, profile, section_id, status) VALUES ('${TEST_LEARNER_ID}', 'level-0', '0.1', 'in_progress')`);
    sqliteDb.exec(`INSERT INTO curriculum_progress (learner_id, profile, section_id, status) VALUES ('${TEST_LEARNER_ID}', 'level-1', '1.1', 'in_progress')`);

    await publishVersion(db, "level-0", SAMPLE_CURRICULUM, SAMPLE_HASH);
    await publishVersion(db, "level-1", SAMPLE_CURRICULUM, "otherhash");

    await db.prepare(
      `INSERT OR IGNORE INTO enrollments (id, learner_id, profile, curriculum_version)
       SELECT hex(randomblob(16)), learner_id, profile, 1
       FROM (SELECT DISTINCT learner_id, profile FROM curriculum_progress)`
    ).run();

    const e0 = await getEnrollment(db, TEST_LEARNER_ID, "level-0");
    const e1 = await getEnrollment(db, TEST_LEARNER_ID, "level-1");
    expect(e0).not.toBeNull();
    expect(e1).not.toBeNull();
    expect(e0!.id).not.toBe(e1!.id);
  });
});

/* ---- Fallback behavior ---- */

describe("Fallback behavior", () => {
  it("empty curriculum_versions table -> enrollment falls back to version 1", async () => {
    const enrollment = await getOrCreateEnrollment(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(enrollment.curriculum_version).toBe(1);
  });

  it("corrupt content_json -> loadCurriculumByVersion returns null", async () => {
    sqliteDb.exec(`INSERT INTO curriculum_versions (id, profile, version, content_json, content_hash) VALUES ('bad', '${TEST_PROFILE}', 1, 'not-json{{{', 'badhash')`);

    const result = await loadCurriculumByVersion(db, TEST_PROFILE, 1);
    expect(result).toBeNull();
  });
});
