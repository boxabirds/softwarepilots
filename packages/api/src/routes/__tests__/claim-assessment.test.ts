import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  buildSocraticTools,
  buildSocraticSystemPrompt,
  parseSocraticResponse,
  extractClaimAssessment,
} from "../socratic-chat";
import type { SocraticChatResponse } from "../socratic-chat";
import {
  updateSectionProgress,
  buildProgressContext,
  applyClaimUpdates,
} from "../curriculum-progress";
import type { SocraticResponse } from "../curriculum-progress";
import { ENROLLMENT_TABLES_SQL, seedCurriculumVersions, TEST_SOCRATIC_PERSONA, TEST_SOCRATIC_RULES } from "./test-schema";
import {
  getCurriculumMeta,
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";
import type { GeminiFunctionCallResponse } from "../../lib/gemini";

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

/* ---- Helpers ---- */

const geminiResponse = (
  name: string,
  args: Record<string, string>
): GeminiFunctionCallResponse => ({
  candidates: [
    {
      content: {
        parts: [{ functionCall: { name, args } }],
      },
    },
  ],
});

const geminiMultiResponse = (
  calls: Array<{ name: string; args: Record<string, string> }>
): GeminiFunctionCallResponse => ({
  candidates: [
    {
      content: {
        parts: calls.map((fc) => ({ functionCall: fc })),
      },
    },
  ],
});

/* ---- Test fixtures ---- */

const TEST_LEARNER_ID = "test-learner-claims";
const TEST_PROFILE = "level-1" as const;
const TEST_META = getCurriculumMeta(TEST_PROFILE);
const TEST_SECTIONS = getCurriculumSections(TEST_PROFILE);
const TEST_SECTION = getSection(TEST_PROFILE, TEST_SECTIONS[0].id);

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

  sqliteDb.exec(ENROLLMENT_TABLES_SQL);
  seedCurriculumVersions(sqliteDb);

  sqliteDb
    .prepare(
      "INSERT INTO learners (id, email, display_name, auth_provider, auth_subject) VALUES (?, ?, ?, ?, ?)"
    )
    .run(TEST_LEARNER_ID, "claims-test@example.com", "Claims Tester", "github", "99999");

  db = createD1Shim(sqliteDb);
});

/* ---- 1. claim_assessment in SIDE_EFFECT_TOOLS ---- */

describe("claim_assessment tool registration", () => {
  it("claim_assessment is in the tool declarations when learning map has claims", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).toContain("claim_assessment");
  });

  it("claim_assessment is a side-effect tool (no reply text produced)", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "socratic_probe",
          args: { response: "What do you think?", topic: "test", confidence_assessment: "medium" },
        },
        {
          name: "claim_assessment",
          args: {
            claims_demonstrated: JSON.stringify(["claim-1"]),
            claim_levels: JSON.stringify(["solid"]),
          },
        },
      ])
    );
    // Reply should only come from socratic_probe, not claim_assessment
    expect(result.reply).toBe("What do you think?");
    expect(result.tool_type).toContain("claim_assessment");
  });
});

/* ---- 2. extractClaimAssessment parsing ---- */

describe("extractClaimAssessment", () => {
  it("parses JSON array claim IDs and levels", () => {
    const result: SocraticChatResponse = { reply: "", tool_type: "" };
    extractClaimAssessment(
      {
        name: "claim_assessment",
        args: {
          claims_demonstrated: JSON.stringify(["claim-1", "claim-3"]),
          claim_levels: JSON.stringify(["solid", "developing"]),
        },
      },
      result
    );
    expect(result.claims_demonstrated).toEqual(["claim-1", "claim-3"]);
    expect(result.claim_levels).toEqual(["solid", "developing"]);
  });

  it("parses comma-separated fallback", () => {
    const result: SocraticChatResponse = { reply: "", tool_type: "" };
    extractClaimAssessment(
      {
        name: "claim_assessment",
        args: {
          claims_demonstrated: "claim-1, claim-2",
          claim_levels: "solid, developing",
        },
      },
      result
    );
    expect(result.claims_demonstrated).toEqual(["claim-1", "claim-2"]);
    expect(result.claim_levels).toEqual(["solid", "developing"]);
  });

  it("parses misconceptions_surfaced and misconceptions_resolved", () => {
    const result: SocraticChatResponse = { reply: "", tool_type: "" };
    extractClaimAssessment(
      {
        name: "claim_assessment",
        args: {
          claims_demonstrated: JSON.stringify(["claim-1"]),
          claim_levels: JSON.stringify(["solid"]),
          misconceptions_surfaced: JSON.stringify(["misconception-1"]),
          misconceptions_resolved: JSON.stringify(["misconception-2"]),
        },
      },
      result
    );
    expect(result.misconceptions_surfaced).toEqual(["misconception-1"]);
    expect(result.misconceptions_resolved).toEqual(["misconception-2"]);
  });

  it("ignores non-claim_assessment function calls", () => {
    const result: SocraticChatResponse = { reply: "", tool_type: "" };
    extractClaimAssessment(
      {
        name: "track_concepts",
        args: {
          claims_demonstrated: JSON.stringify(["claim-1"]),
          claim_levels: JSON.stringify(["solid"]),
        },
      },
      result
    );
    expect(result.claims_demonstrated).toBeUndefined();
  });
});

/* ---- 3. applyClaimUpdates logic ---- */

describe("applyClaimUpdates", () => {
  it("creates new claims from empty state", () => {
    const response: SocraticResponse = {
      claims_demonstrated: ["claim-1", "claim-2"],
      claim_levels: ["solid", "developing"],
    };
    const result = applyClaimUpdates(null, response);
    expect(result).not.toBeNull();
    expect(result!["claim-1"].level).toBe("solid");
    expect(result!["claim-2"].level).toBe("developing");
    expect(result!["claim-1"].timestamp).toBeTruthy();
  });

  it("updates existing claim to higher level", () => {
    const existing = JSON.stringify({
      "claim-1": { level: "developing", timestamp: "2025-01-01T00:00:00Z" },
    });
    const response: SocraticResponse = {
      claims_demonstrated: ["claim-1"],
      claim_levels: ["solid"],
    };
    const result = applyClaimUpdates(existing, response);
    expect(result).not.toBeNull();
    expect(result!["claim-1"].level).toBe("solid");
  });

  it("prevents downgrade from solid to developing", () => {
    const existing = JSON.stringify({
      "claim-1": { level: "solid", timestamp: "2025-01-01T00:00:00Z" },
    });
    const response: SocraticResponse = {
      claims_demonstrated: ["claim-1"],
      claim_levels: ["developing"],
    };
    const result = applyClaimUpdates(existing, response);
    // No changes should be made
    expect(result).toBeNull();
  });

  it("prevents downgrade from strong to solid", () => {
    const existing = JSON.stringify({
      "claim-1": { level: "strong", timestamp: "2025-01-01T00:00:00Z" },
    });
    const response: SocraticResponse = {
      claims_demonstrated: ["claim-1"],
      claim_levels: ["solid"],
    };
    const result = applyClaimUpdates(existing, response);
    expect(result).toBeNull();
  });

  it("allows upgrade from developing to strong", () => {
    const existing = JSON.stringify({
      "claim-1": { level: "developing", timestamp: "2025-01-01T00:00:00Z" },
    });
    const response: SocraticResponse = {
      claims_demonstrated: ["claim-1"],
      claim_levels: ["strong"],
    };
    const result = applyClaimUpdates(existing, response);
    expect(result).not.toBeNull();
    expect(result!["claim-1"].level).toBe("strong");
  });

  it("returns null when no claims in response", () => {
    const result = applyClaimUpdates(null, {});
    expect(result).toBeNull();
  });

  it("returns null when claims array is empty", () => {
    const result = applyClaimUpdates(null, { claims_demonstrated: [], claim_levels: [] });
    expect(result).toBeNull();
  });

  it("defaults to developing when no level provided", () => {
    const response: SocraticResponse = {
      claims_demonstrated: ["claim-1"],
    };
    const result = applyClaimUpdates(null, response);
    expect(result).not.toBeNull();
    expect(result!["claim-1"].level).toBe("developing");
  });

  it("handles malformed existing JSON gracefully", () => {
    const response: SocraticResponse = {
      claims_demonstrated: ["claim-1"],
      claim_levels: ["solid"],
    };
    const result = applyClaimUpdates("not valid json", response);
    expect(result).not.toBeNull();
    expect(result!["claim-1"].level).toBe("solid");
  });
});

/* ---- 4. Full exchange: claim_assessment stored in DB ---- */

describe("claim_assessment DB storage via updateSectionProgress", () => {
  it("stores claims_json on first interaction with claims", async () => {
    const response: SocraticResponse = {
      tool_type: "socratic_probe+claim_assessment",
      claims_demonstrated: ["claim-1"],
      claim_levels: ["solid"],
    };
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id, response);

    const row = sqliteDb
      .prepare("SELECT claims_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?")
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id) as Record<string, unknown>;

    expect(row).toBeTruthy();
    const claims = JSON.parse(row.claims_json as string);
    expect(claims["claim-1"]).toBeTruthy();
    expect(claims["claim-1"].level).toBe("solid");
  });

  it("accumulates claims across multiple exchanges", async () => {
    // First exchange: claim-1
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id, {
      claims_demonstrated: ["claim-1"],
      claim_levels: ["developing"],
    });

    // Second exchange: claim-2
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id, {
      claims_demonstrated: ["claim-2"],
      claim_levels: ["solid"],
    });

    const row = sqliteDb
      .prepare("SELECT claims_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?")
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id) as Record<string, unknown>;

    const claims = JSON.parse(row.claims_json as string);
    expect(claims["claim-1"].level).toBe("developing");
    expect(claims["claim-2"].level).toBe("solid");
  });

  it("prevents claim downgrade in DB path", async () => {
    // First: solid
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id, {
      claims_demonstrated: ["claim-1"],
      claim_levels: ["solid"],
    });

    // Second: attempt developing (should not downgrade)
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id, {
      claims_demonstrated: ["claim-1"],
      claim_levels: ["developing"],
    });

    const row = sqliteDb
      .prepare("SELECT claims_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?")
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id) as Record<string, unknown>;

    const claims = JSON.parse(row.claims_json as string);
    expect(claims["claim-1"].level).toBe("solid");
  });
});

/* ---- 5. buildProgressContext includes claim coverage ---- */

describe("buildProgressContext with claims", () => {
  it("includes demonstrated and not-yet-demonstrated claims", async () => {
    // Insert a progress row with claims_json
    const claimsMap = {
      "claim-1": { level: "solid", timestamp: "2025-01-01T00:00:00Z" },
      "claim-3": { level: "developing", timestamp: "2025-01-01T00:00:00Z" },
    };
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, started_at, updated_at)
         VALUES (?, ?, ?, 'in_progress', '[]', '{}', ?, datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id, JSON.stringify(claimsMap));

    const context = await buildProgressContext(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(context).toContain("Claim Coverage");
    expect(context).toContain("claim-1 (solid)");
    expect(context).toContain("claim-3 (developing)");
    expect(context).toContain("Not yet demonstrated");
  });

  it("omits claim coverage when claims_json is empty", async () => {
    sqliteDb
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, started_at, updated_at)
         VALUES (?, ?, ?, 'in_progress', '[]', '{}', '{}', datetime('now'), datetime('now'))`
      )
      .run(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id);

    const context = await buildProgressContext(db, TEST_LEARNER_ID, TEST_PROFILE);
    expect(context).not.toContain("Claim Coverage");
  });
});

/* ---- 6. buildSocraticSystemPrompt includes learning map ---- */

describe("buildSocraticSystemPrompt with learning map", () => {
  it("includes core claims and demonstration criteria", () => {
    const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, [], TEST_SOCRATIC_PERSONA, TEST_SOCRATIC_RULES);
    expect(prompt).toContain("Section Learning Map");
    expect(prompt).toContain("Core claims to cover");
    // Check that actual claim content from the learning map is present
    const firstClaim = TEST_SECTION.learning_map.core_claims[0];
    if (firstClaim) {
      expect(prompt).toContain(firstClaim.id);
      expect(prompt).toContain(firstClaim.statement);
      expect(prompt).toContain("Demonstrated when:");
    }
  });

  it("includes misconceptions with corrections", () => {
    const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, [], TEST_SOCRATIC_PERSONA, TEST_SOCRATIC_RULES);
    if (TEST_SECTION.learning_map.key_misconceptions.length > 0) {
      expect(prompt).toContain("Common misconceptions to watch for");
      const firstMisconception = TEST_SECTION.learning_map.key_misconceptions[0];
      expect(prompt).toContain(firstMisconception.belief);
      expect(prompt).toContain(firstMisconception.correction);
    }
  });

  it("includes key intuition decomposition steps", () => {
    const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, [], TEST_SOCRATIC_PERSONA, TEST_SOCRATIC_RULES);
    if (TEST_SECTION.learning_map.key_intuition_decomposition.length > 0) {
      expect(prompt).toContain("Key intuition builds through these steps");
      const firstStep = TEST_SECTION.learning_map.key_intuition_decomposition[0];
      expect(prompt).toContain(firstStep.statement);
      // Should end with the key intuition
      expect(prompt).toContain(`-> ${TEST_SECTION.key_intuition}`);
    }
  });
});

/* ---- 7. claim_assessment and track_concepts both fire in same exchange ---- */

describe("claim_assessment combined with track_concepts", () => {
  it("parses both side-effect tools in a single multi-tool response", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "evaluate_response",
          args: {
            assessment: "Good analysis",
            follow_up: "Can you explain further?",
            understanding_level: "solid",
            topic: "concurrency",
          },
        },
        {
          name: "track_concepts",
          args: {
            concepts_demonstrated: JSON.stringify(["concurrency", "race conditions"]),
            concept_levels: JSON.stringify(["solid", "developing"]),
          },
        },
        {
          name: "claim_assessment",
          args: {
            claims_demonstrated: JSON.stringify(["claim-1", "claim-2"]),
            claim_levels: JSON.stringify(["solid", "developing"]),
            misconceptions_surfaced: JSON.stringify(["misconception-1"]),
          },
        },
      ])
    );

    // Reply from evaluate_response
    expect(result.reply).toContain("Good analysis");
    expect(result.reply).toContain("Can you explain further?");

    // track_concepts data
    expect(result.concepts_demonstrated).toEqual(["concurrency", "race conditions"]);
    expect(result.concept_levels).toEqual(["solid", "developing"]);

    // claim_assessment data
    expect(result.claims_demonstrated).toEqual(["claim-1", "claim-2"]);
    expect(result.claim_levels).toEqual(["solid", "developing"]);
    expect(result.misconceptions_surfaced).toEqual(["misconception-1"]);

    // tool_type includes all three
    expect(result.tool_type).toContain("evaluate_response");
    expect(result.tool_type).toContain("track_concepts");
    expect(result.tool_type).toContain("claim_assessment");
  });

  it("stores both concepts and claims in DB when both fire", async () => {
    const response: SocraticResponse = {
      tool_type: "evaluate_response+track_concepts+claim_assessment",
      concepts_demonstrated: ["concurrency"],
      concept_levels: ["solid"],
      claims_demonstrated: ["claim-1"],
      claim_levels: ["solid"],
    };
    await updateSectionProgress(db, TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id, response);

    const row = sqliteDb
      .prepare("SELECT concepts_json, claims_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?")
      .get(TEST_LEARNER_ID, TEST_PROFILE, TEST_SECTION.id) as Record<string, unknown>;

    const concepts = JSON.parse(row.concepts_json as string);
    expect(concepts["concurrency"]).toBeTruthy();

    const claims = JSON.parse(row.claims_json as string);
    expect(claims["claim-1"]).toBeTruthy();
    expect(claims["claim-1"].level).toBe("solid");
  });
});
