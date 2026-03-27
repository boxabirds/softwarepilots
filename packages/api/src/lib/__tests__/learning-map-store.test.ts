/**
 * Integration tests for learning map DB store and content hashing (Story 61).
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  computeContentHash,
  getLearningMapFromDB,
  storeLearningMap,
} from "../learning-map-store";
import type { SectionLearningMap } from "@softwarepilots/shared";

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
          return { results: rows, success: true, meta: {} as D1Result<T>["meta"] };
        },
        async run(): Promise<D1Response> {
          const stmt = sqliteDb.prepare(query);
          const info = stmt.run(...bindings);
          return {
            success: true,
            meta: { duration: 0, changes: info.changes, last_row_id: info.lastInsertRowid as number, changed_db: info.changes > 0, size_after: 0, rows_read: 0, rows_written: info.changes },
          };
        },
      } as unknown as D1PreparedStatement;
    },
    async batch<T>(): Promise<D1Result<T>[]> { throw new Error("not implemented"); },
    async dump(): Promise<ArrayBuffer> { throw new Error("not implemented"); },
    async exec(): Promise<D1ExecResult> { throw new Error("not implemented"); },
  } as unknown as D1Database;
}

/* ---- Fixtures ---- */

const SAMPLE_MAP: SectionLearningMap = {
  section_id: "0.1",
  generated_at: "2025-01-01T00:00:00Z",
  model_used: "gemini-2.0-flash",
  prerequisites: [],
  core_claims: [
    {
      id: "claim-1",
      statement: "Servers have finite resources",
      concepts: ["Virtual servers"],
      demonstration_criteria: "Can explain why a server might run out of memory",
    },
    {
      id: "claim-2",
      statement: "Databases need indexes for performance",
      concepts: ["Indexes"],
      demonstration_criteria: "Can identify a missing index in a slow query",
    },
    {
      id: "claim-3",
      statement: "APIs define contracts between components",
      concepts: ["REST APIs"],
      demonstration_criteria: "Can describe what happens when an API contract is violated",
    },
  ],
  key_misconceptions: [
    {
      id: "misconception-1",
      belief: "Servers scale infinitely",
      correction: "Servers have finite CPU, memory, and network bandwidth",
      related_claims: ["claim-1"],
    },
  ],
  key_intuition_decomposition: [
    { id: "insight-1", statement: "Naming enables reasoning", order: 1 },
    { id: "insight-2", statement: "Understanding enables anticipation", order: 2 },
  ],
};

/* ---- Setup ---- */

let sqliteDb: InstanceType<typeof Database>;
let db: D1Database;

beforeEach(() => {
  sqliteDb = new Database(":memory:");
  sqliteDb.exec(`
    CREATE TABLE learning_maps (
      profile       TEXT NOT NULL,
      section_id    TEXT NOT NULL,
      content_hash  TEXT NOT NULL,
      map_json      TEXT NOT NULL,
      model_used    TEXT NOT NULL,
      generated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (profile, section_id, content_hash)
    );
  `);
  db = createD1Shim(sqliteDb);
});

afterEach(() => {
  sqliteDb?.close();
});

/* ---- Content hashing ---- */

describe("computeContentHash", () => {
  it("produces same hash for same inputs (deterministic)", async () => {
    const hash1 = await computeContentHash("markdown", "intuition", ["concept1"]);
    const hash2 = await computeContentHash("markdown", "intuition", ["concept1"]);
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different markdown", async () => {
    const hash1 = await computeContentHash("markdown A", "intuition", ["concept1"]);
    const hash2 = await computeContentHash("markdown B", "intuition", ["concept1"]);
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hash for different key intuition", async () => {
    const hash1 = await computeContentHash("markdown", "intuition A", ["concept1"]);
    const hash2 = await computeContentHash("markdown", "intuition B", ["concept1"]);
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hash for different concepts", async () => {
    const hash1 = await computeContentHash("markdown", "intuition", ["concept1"]);
    const hash2 = await computeContentHash("markdown", "intuition", ["concept2"]);
    expect(hash1).not.toBe(hash2);
  });

  it("produces a 64-character hex string", async () => {
    const hash = await computeContentHash("test", "test", []);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles empty inputs", async () => {
    const hash = await computeContentHash("", "", []);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles unicode content", async () => {
    const hash = await computeContentHash("## Emoji test", "Key insight", ["Concept"]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

/* ---- Store and retrieve ---- */

describe("storeLearningMap + getLearningMapFromDB", () => {
  it("store then retrieve returns identical map", async () => {
    await storeLearningMap(db, "level-0", "0.1", "hash123", SAMPLE_MAP, "gemini-2.0-flash");

    const retrieved = await getLearningMapFromDB(db, "level-0", "0.1", "hash123");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.section_id).toBe("0.1");
    expect(retrieved!.core_claims).toHaveLength(3);
    expect(retrieved!.core_claims[0].id).toBe("claim-1");
    expect(retrieved!.key_misconceptions).toHaveLength(1);
    expect(retrieved!.key_intuition_decomposition).toHaveLength(2);
  });

  it("retrieve with wrong hash returns null", async () => {
    await storeLearningMap(db, "level-0", "0.1", "hash123", SAMPLE_MAP, "gemini-2.0-flash");

    const retrieved = await getLearningMapFromDB(db, "level-0", "0.1", "wrong-hash");
    expect(retrieved).toBeNull();
  });

  it("retrieve with wrong profile returns null", async () => {
    await storeLearningMap(db, "level-0", "0.1", "hash123", SAMPLE_MAP, "gemini-2.0-flash");

    const retrieved = await getLearningMapFromDB(db, "level-1", "0.1", "hash123");
    expect(retrieved).toBeNull();
  });

  it("retrieve from empty table returns null", async () => {
    const retrieved = await getLearningMapFromDB(db, "level-0", "0.1", "hash123");
    expect(retrieved).toBeNull();
  });

  it("INSERT OR REPLACE updates existing row for same PK", async () => {
    const updatedMap = { ...SAMPLE_MAP, generated_at: "2025-06-01T00:00:00Z" };

    await storeLearningMap(db, "level-0", "0.1", "hash123", SAMPLE_MAP, "gemini-2.0-flash");
    await storeLearningMap(db, "level-0", "0.1", "hash123", updatedMap, "gemini-2.0-flash");

    // Should have exactly one row
    const count = sqliteDb
      .prepare("SELECT count(*) as cnt FROM learning_maps WHERE profile = 'level-0' AND section_id = '0.1'")
      .get() as { cnt: number };
    expect(count.cnt).toBe(1);

    const retrieved = await getLearningMapFromDB(db, "level-0", "0.1", "hash123");
    expect(retrieved!.generated_at).toBe("2025-06-01T00:00:00Z");
  });

  it("multiple versions coexist with different content hashes", async () => {
    await storeLearningMap(db, "level-0", "0.1", "hashV1", SAMPLE_MAP, "gemini-2.0-flash");

    const v2Map = { ...SAMPLE_MAP, generated_at: "2025-06-01T00:00:00Z" };
    await storeLearningMap(db, "level-0", "0.1", "hashV2", v2Map, "gemini-2.0-flash");

    const v1 = await getLearningMapFromDB(db, "level-0", "0.1", "hashV1");
    const v2 = await getLearningMapFromDB(db, "level-0", "0.1", "hashV2");

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    expect(v1!.generated_at).toBe("2025-01-01T00:00:00Z");
    expect(v2!.generated_at).toBe("2025-06-01T00:00:00Z");
  });

  it("handles corrupt map_json gracefully", async () => {
    // Insert corrupt data directly
    sqliteDb.exec(
      `INSERT INTO learning_maps (profile, section_id, content_hash, map_json, model_used)
       VALUES ('level-0', '0.1', 'badhash', 'not-json{{{', 'test')`
    );

    const retrieved = await getLearningMapFromDB(db, "level-0", "0.1", "badhash");
    expect(retrieved).toBeNull();
  });
});
