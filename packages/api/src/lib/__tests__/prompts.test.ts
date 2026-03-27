/**
 * Integration tests for prompt CRUD operations (Story 49).
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { getPrompt, savePrompt, listPrompts, getPromptHistory } from "../prompts";

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

/* ---- Setup ---- */

let sqliteDb: InstanceType<typeof Database>;
let db: D1Database;

beforeEach(() => {
  sqliteDb = new Database(":memory:");
  sqliteDb.exec(`
    CREATE TABLE prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT,
      reason TEXT,
      UNIQUE(key, version)
    );
    CREATE INDEX idx_prompts_key ON prompts(key) WHERE deleted = 0;
    CREATE INDEX idx_prompts_history ON prompts(key, version DESC);
  `);
  db = createD1Shim(sqliteDb);
});

afterEach(() => { sqliteDb?.close(); });

/* ---- savePrompt ---- */

describe("savePrompt", () => {
  it("creates version 1 for a new key", async () => {
    const result = await savePrompt(db, "socratic.rules", "Be Socratic.", { createdBy: "admin", reason: "Initial" });
    expect(result.key).toBe("socratic.rules");
    expect(result.content).toBe("Be Socratic.");
    expect(result.version).toBe(1);
    expect(result.deleted).toBe(0);
    expect(result.created_by).toBe("admin");
    expect(result.reason).toBe("Initial");
    expect(result.created_at).toBeTruthy();
  });

  it("creates version 2 and soft-deletes version 1", async () => {
    await savePrompt(db, "socratic.rules", "Version 1 text", { reason: "v1" });
    const v2 = await savePrompt(db, "socratic.rules", "Version 2 text", { reason: "v2" });

    expect(v2.version).toBe(2);
    expect(v2.content).toBe("Version 2 text");

    // v1 should be soft-deleted
    const row = sqliteDb.prepare("SELECT deleted FROM prompts WHERE key = ? AND version = 1").get("socratic.rules") as { deleted: number };
    expect(row.deleted).toBe(1);
  });

  it("accepts empty content", async () => {
    const result = await savePrompt(db, "empty.prompt", "", { reason: "Placeholder" });
    expect(result.content).toBe("");
    expect(result.version).toBe(1);
  });

  it("stores created_by and reason correctly", async () => {
    const result = await savePrompt(db, "test.key", "content", { createdBy: "julian", reason: "Testing metadata" });
    expect(result.created_by).toBe("julian");
    expect(result.reason).toBe("Testing metadata");
  });

  it("handles null created_by and reason", async () => {
    const result = await savePrompt(db, "test.key", "content");
    expect(result.created_by).toBeNull();
    expect(result.reason).toBeNull();
  });
});

/* ---- getPrompt ---- */

describe("getPrompt", () => {
  it("returns latest active version", async () => {
    await savePrompt(db, "socratic.rules", "v1 text", { reason: "v1" });
    await savePrompt(db, "socratic.rules", "v2 text", { reason: "v2" });

    const result = await getPrompt(db, "socratic.rules");
    expect(result.content).toBe("v2 text");
    expect(result.version).toBe(2);
  });

  it("throws for non-existent key", async () => {
    await expect(getPrompt(db, "nonexistent.key")).rejects.toThrow("Prompt not found");
    await expect(getPrompt(db, "nonexistent.key")).rejects.toThrow("seed script");
  });

  it("returns correct fields", async () => {
    await savePrompt(db, "test.key", "test content", { createdBy: "admin", reason: "test" });

    const result = await getPrompt(db, "test.key");
    expect(result.id).toBeGreaterThan(0);
    expect(result.key).toBe("test.key");
    expect(result.content).toBe("test content");
    expect(result.version).toBe(1);
    expect(result.deleted).toBe(0);
  });
});

/* ---- listPrompts ---- */

describe("listPrompts", () => {
  it("returns all active prompts ordered by key", async () => {
    await savePrompt(db, "socratic.rules", "rules", { reason: "seed" });
    await savePrompt(db, "exercise.role", "role", { reason: "seed" });
    await savePrompt(db, "narrative.instructions", "instructions", { reason: "seed" });

    const list = await listPrompts(db);
    expect(list).toHaveLength(3);
    expect(list[0].key).toBe("exercise.role");
    expect(list[1].key).toBe("narrative.instructions");
    expect(list[2].key).toBe("socratic.rules");
  });

  it("returns empty array when no prompts exist", async () => {
    const list = await listPrompts(db);
    expect(list).toEqual([]);
  });

  it("excludes soft-deleted versions", async () => {
    await savePrompt(db, "test.key", "v1", { reason: "v1" });
    await savePrompt(db, "test.key", "v2", { reason: "v2" });

    const list = await listPrompts(db);
    expect(list).toHaveLength(1);
    expect(list[0].version).toBe(2);
  });
});

/* ---- getPromptHistory ---- */

describe("getPromptHistory", () => {
  it("returns all versions including deleted, ordered DESC", async () => {
    await savePrompt(db, "socratic.rules", "v1", { reason: "initial", createdBy: "a" });
    await savePrompt(db, "socratic.rules", "v2", { reason: "update", createdBy: "b" });
    await savePrompt(db, "socratic.rules", "v3", { reason: "fix", createdBy: "c" });

    const history = await getPromptHistory(db, "socratic.rules");
    expect(history).toHaveLength(3);
    expect(history[0].version).toBe(3);
    expect(history[0].content).toBe("v3");
    expect(history[0].deleted).toBe(0);
    expect(history[1].version).toBe(2);
    expect(history[1].deleted).toBe(1);
    expect(history[2].version).toBe(1);
    expect(history[2].deleted).toBe(1);
  });

  it("returns empty array for unknown key", async () => {
    const history = await getPromptHistory(db, "unknown.key");
    expect(history).toEqual([]);
  });

  it("preserves reason and created_by across versions", async () => {
    await savePrompt(db, "test.key", "v1", { reason: "first", createdBy: "alice" });
    await savePrompt(db, "test.key", "v2", { reason: "second", createdBy: "bob" });

    const history = await getPromptHistory(db, "test.key");
    expect(history[0].created_by).toBe("bob");
    expect(history[0].reason).toBe("second");
    expect(history[1].created_by).toBe("alice");
    expect(history[1].reason).toBe("first");
  });
});

/* ---- Concurrent saves ---- */

describe("Concurrent operations", () => {
  it("two saves to same key both succeed with different versions", async () => {
    await savePrompt(db, "test.key", "v1", { reason: "first" });

    // Simulate near-concurrent saves
    const v2 = await savePrompt(db, "test.key", "v2", { reason: "second" });
    const v3 = await savePrompt(db, "test.key", "v3", { reason: "third" });

    expect(v2.version).toBe(2);
    expect(v3.version).toBe(3);

    const current = await getPrompt(db, "test.key");
    expect(current.version).toBe(3);
    expect(current.content).toBe("v3");
  });
});
