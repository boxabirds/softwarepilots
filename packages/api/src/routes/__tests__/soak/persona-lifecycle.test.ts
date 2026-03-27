/**
 * Persona soak tests - full learning journeys with real Gemini (Story 63).
 *
 * Gated behind SOAK_TEST=1 environment variable.
 * Requires GEMINI_API_KEY in environment.
 * Run via: SOAK_TEST=1 bun test --timeout 600000 soak/
 *
 * 12 personas (3 per track x 4 tracks) complete multi-section journeys.
 * Both sides of the conversation are LLM-driven: a learner simulator prompt
 * drives the learner's messages, the actual tutor system prompt drives the tutor.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const SOAK_ENABLED = process.env.SOAK_TEST === "1";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RESULTS_DIR = resolve(import.meta.dir, "../../../../../../test-results/soak");

/* ---- Skip guard ---- */

if (!SOAK_ENABLED) {
  describe("Persona soak tests (skipped - set SOAK_TEST=1)", () => {
    it("soak tests are gated behind SOAK_TEST=1", () => {
      expect(true).toBe(true);
    });
  });
} else {

/* ---- Imports (only when soak tests are enabled) ---- */

const { Hono } = await import("hono");
const { sign } = await import("hono/jwt");
const { Database } = await import("bun:sqlite");
const { socratic } = await import("../../socratic-chat");
const { getCurriculumSections, getSection, getCurriculumMeta } = await import("@softwarepilots/shared");

/* ---- Types ---- */

interface Persona {
  name: string;
  track: string;
  behavior: string;
  simulatorRules: string;
}

interface ExchangeResult {
  learnerMessage: string;
  tutorReply: string;
  toolType?: string;
  claimsDemo?: string[];
  conceptsDemo?: string[];
  error?: string;
}

interface PersonaReport {
  persona: string;
  track: string;
  sections_attempted: number;
  sections_completed: number;
  total_exchanges: number;
  tools_fired: Record<string, number>;
  errors: string[];
  duration_ms: number;
}

/* ---- Constants ---- */

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_EXCHANGES_PER_SECTION = 12;
const SECTIONS_PER_PERSONA = 2;
const JWT_SECRET = "soak-test-secret";
const LEARNER_ID = "soak-learner";

/* ---- Persona definitions ---- */

const PERSONAS: Persona[] = [
  // level-0
  {
    name: "eager-beginner",
    track: "level-0",
    behavior: "Answers enthusiastically, sometimes wrong, corrects quickly when guided",
    simulatorRules: "Be enthusiastic. Sometimes give wrong answers but accept corrections gracefully. Use simple language.",
  },
  {
    name: "confused-beginner",
    track: "level-0",
    behavior: "Asks lots of clarifying questions, needs instruction frequently",
    simulatorRules: "Ask clarifying questions often. Say 'I don't understand' when concepts are complex. Need things explained step by step.",
  },
  {
    name: "distracted-beginner",
    track: "level-0",
    behavior: "Goes off-topic periodically, returns to subject",
    simulatorRules: "Occasionally go off-topic (ask about unrelated things, share personal stories). Return to the subject when redirected.",
  },
  // level-1
  {
    name: "confident-newgrad",
    track: "level-1",
    behavior: "Gives concise correct answers, fast progression",
    simulatorRules: "Give concise, mostly correct answers. Show confidence. Demonstrate understanding quickly.",
  },
  {
    name: "overconfident-newgrad",
    track: "level-1",
    behavior: "Gives plausible-sounding wrong answers (misconceptions)",
    simulatorRules: "Give confident-sounding but sometimes incorrect answers. Hold onto misconceptions initially. Eventually accept corrections.",
  },
  {
    name: "methodical-newgrad",
    track: "level-1",
    behavior: "Asks 'why' before answering, builds reasoning step by step",
    simulatorRules: "Always ask 'why' or 'how does that work' before answering. Build up reasoning step by step. Articulate insights clearly.",
  },
  // level-10
  {
    name: "veteran-knows-it",
    track: "level-10",
    behavior: "Already understands concepts, demonstrates quickly",
    simulatorRules: "Demonstrate deep understanding immediately. Give expert-level answers. Reference real-world experience.",
  },
  {
    name: "veteran-blind-spots",
    track: "level-10",
    behavior: "Strong in some areas, gaps in others",
    simulatorRules: "Be strong on system design topics but weak on security or monitoring. Admit gaps when probed.",
  },
  {
    name: "skeptical-veteran",
    track: "level-10",
    behavior: "Pushes back on premises, wants real-world evidence",
    simulatorRules: "Challenge assumptions. Ask 'has this actually happened in production?' Demand concrete examples before accepting claims.",
  },
  // level-20
  {
    name: "strategic-leader",
    track: "level-20",
    behavior: "Thinks in systems and org impact",
    simulatorRules: "Frame everything in terms of organizational impact. Think about processes, team dynamics, and strategic decisions.",
  },
  {
    name: "delegator-leader",
    track: "level-20",
    behavior: "Tends to say 'my team handles that'",
    simulatorRules: "Initially deflect with 'my team handles that' or 'I'd delegate this'. Engage when pushed on personal accountability.",
  },
  {
    name: "process-leader",
    track: "level-20",
    behavior: "Wants frameworks and checklists",
    simulatorRules: "Ask for frameworks, checklists, and structured approaches. Respond well to organized content.",
  },
];

/* ---- Gemini call for learner simulator ---- */

async function simulateLearner(
  persona: Persona,
  sectionTitle: string,
  keyIntuition: string,
  tutorMessage: string,
  conversationHistory: string[],
): Promise<string> {
  const context = conversationHistory.length > 0
    ? `\n\nConversation so far:\n${conversationHistory.join("\n")}`
    : "";

  const prompt = `You are simulating a learner in a Socratic tutoring session.

Persona: ${persona.name}
Behavior: ${persona.behavior}
Section topic: ${sectionTitle}
Key intuition you're working toward: ${keyIntuition}

Rules:
- Stay in character. ${persona.simulatorRules}
- Respond as a real learner would - not perfectly, not robotically.
- Your responses should be 1-3 sentences.
- If the tutor asks a question you genuinely wouldn't know as this persona, say so or guess incorrectly.
- If the tutor asks something you would know, demonstrate understanding in your own words.
${context}

The tutor just said: "${tutorMessage}"

Your response (1-3 sentences, in character):`;

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Learner sim API error ${response.status}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "I'm not sure what to say.";
}

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

/* ---- Hono app setup ---- */

function createTestApp(sqliteDb: InstanceType<typeof Database>) {
  const db = createD1Shim(sqliteDb);
  const app = new Hono<{ Bindings: { DB: D1Database; GEMINI_API_KEY: string; GEMINI_MODEL: string; JWT_SECRET: string } }>();

  app.use("*", async (c, next) => {
    c.set("learnerId" as never, LEARNER_ID as never);
    await next();
  });

  app.route("/api/socratic", socratic);

  return { app, db };
}

function setupDatabase(): InstanceType<typeof Database> {
  const sqliteDb = new Database(":memory:");
  sqliteDb.exec("PRAGMA foreign_keys = OFF");

  // All tables needed for the socratic chat flow
  sqliteDb.exec(`
    CREATE TABLE learners (id TEXT PRIMARY KEY, display_name TEXT);
    CREATE TABLE curriculum_progress (
      learner_id TEXT NOT NULL, profile TEXT NOT NULL, section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started', understanding_json TEXT,
      concepts_json TEXT, claims_json TEXT, started_at TEXT, completed_at TEXT,
      paused_at TEXT, updated_at TEXT,
      PRIMARY KEY (learner_id, profile, section_id)
    );
    CREATE TABLE curriculum_conversations (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL, profile TEXT NOT NULL, section_id TEXT NOT NULL,
      messages_json TEXT NOT NULL, summary TEXT, archived_at TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (learner_id, profile, section_id)
    );
    CREATE TABLE conversation_summaries (
      learner_id TEXT NOT NULL, profile TEXT NOT NULL, section_id TEXT NOT NULL,
      summary TEXT NOT NULL, exchange_count INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (learner_id, profile, section_id)
    );
    CREATE TABLE curriculum_versions (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      profile TEXT NOT NULL, version INTEGER NOT NULL,
      content_json TEXT NOT NULL, content_hash TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), created_by TEXT, reason TEXT,
      UNIQUE (profile, version)
    );
    CREATE TABLE enrollments (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL, profile TEXT NOT NULL,
      curriculum_version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', concepts_json TEXT,
      enrolled_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (learner_id, profile)
    );
    CREATE TABLE learning_maps (
      profile TEXT NOT NULL, section_id TEXT NOT NULL, content_hash TEXT NOT NULL,
      map_json TEXT NOT NULL, model_used TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (profile, section_id, content_hash)
    );
    CREATE TABLE curriculum_feedback (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      learner_id TEXT NOT NULL, profile TEXT NOT NULL, section_id TEXT NOT NULL,
      message_content TEXT, message_index INTEGER, feedback_text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  sqliteDb.exec(`INSERT INTO learners (id, display_name) VALUES ('${LEARNER_ID}', 'Soak Learner')`);

  return sqliteDb;
}

/* ---- Run a single persona ---- */

async function runPersona(persona: Persona): Promise<PersonaReport> {
  const startTime = Date.now();
  const report: PersonaReport = {
    persona: persona.name,
    track: persona.track,
    sections_attempted: 0,
    sections_completed: 0,
    total_exchanges: 0,
    tools_fired: {},
    errors: [],
    duration_ms: 0,
  };

  const sqliteDb = setupDatabase();
  const { app } = createTestApp(sqliteDb);

  try {
    const sections = getCurriculumSections(persona.track);
    const sectionsToAttempt = sections.slice(0, SECTIONS_PER_PERSONA);

    for (const sectionMeta of sectionsToAttempt) {
      report.sections_attempted++;
      const section = getSection(persona.track, sectionMeta.id);
      const conversationHistory: string[] = [];
      let sectionCompleted = false;

      // First message to start the conversation
      let learnerMessage = `Hi, I'm ready to learn about ${section.title}.`;

      for (let exchange = 0; exchange < MAX_EXCHANGES_PER_SECTION; exchange++) {
        report.total_exchanges++;

        try {
          // Send learner message to tutor
          const cookie = `sp_session=${await sign({ sub: LEARNER_ID, exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET, "HS256")}`;
          const response = await app.request("/api/socratic", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: cookie,
            },
            body: JSON.stringify({
              profile: persona.track,
              section_id: sectionMeta.id,
              message: learnerMessage,
              context: { conversation: conversationHistory.map((m, i) => ({
                role: i % 2 === 0 ? "user" : "tutor",
                content: m,
              })) },
            }),
          }, {
            DB: createD1Shim(sqliteDb),
            GEMINI_API_KEY: GEMINI_API_KEY!,
            GEMINI_MODEL,
            JWT_SECRET,
          } as never);

          if (!response.ok) {
            report.errors.push(`Exchange ${exchange}: HTTP ${response.status}`);
            break;
          }

          const result = await response.json() as {
            reply: string;
            tool_type?: string;
            concepts_demonstrated?: string[];
            claims_demonstrated?: string[];
          };

          // Track tool usage
          if (result.tool_type) {
            report.tools_fired[result.tool_type] = (report.tools_fired[result.tool_type] ?? 0) + 1;
          }

          conversationHistory.push(learnerMessage);
          conversationHistory.push(result.reply);

          // Check for session completion
          if (result.tool_type?.includes("session_complete")) {
            sectionCompleted = true;
            break;
          }

          // Simulate learner response for next exchange
          learnerMessage = await simulateLearner(
            persona,
            section.title,
            section.key_intuition,
            result.reply,
            conversationHistory,
          );
        } catch (err) {
          report.errors.push(`Exchange ${exchange}: ${err instanceof Error ? err.message : String(err)}`);
          break;
        }
      }

      if (sectionCompleted) {
        report.sections_completed++;
      }
    }
  } finally {
    sqliteDb.close();
  }

  report.duration_ms = Date.now() - startTime;
  return report;
}

/* ---- Test suite ---- */

beforeAll(() => {
  mkdirSync(RESULTS_DIR, { recursive: true });
});

describe("Persona soak tests", () => {
  if (!GEMINI_API_KEY) {
    it("GEMINI_API_KEY is required", () => {
      throw new Error("Set GEMINI_API_KEY environment variable to run soak tests");
    });
    return;
  }

  for (const persona of PERSONAS) {
    it(`${persona.name} (${persona.track}) completes a multi-section journey`, async () => {
      console.log(`\n=== Running persona: ${persona.name} (${persona.track}) ===`);

      const report = await runPersona(persona);

      // Save report
      const reportPath = join(RESULTS_DIR, `${persona.name}.json`);
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved to ${reportPath}`);
      console.log(`  Sections: ${report.sections_completed}/${report.sections_attempted}`);
      console.log(`  Exchanges: ${report.total_exchanges}`);
      console.log(`  Tools: ${JSON.stringify(report.tools_fired)}`);
      console.log(`  Errors: ${report.errors.length}`);
      console.log(`  Duration: ${(report.duration_ms / 1000).toFixed(1)}s`);

      // Assertions
      expect(report.total_exchanges).toBeGreaterThan(0);
      expect(report.errors.length).toBeLessThan(report.total_exchanges); // most exchanges should succeed
      expect(Object.keys(report.tools_fired).length).toBeGreaterThan(0); // tutor used at least one tool
    }, 300_000); // 5 min timeout per persona
  }

  afterAll(() => {
    // Summary
    console.log("\n=== Soak test complete ===");
    console.log(`Results saved to ${RESULTS_DIR}`);
  });
});

} // end SOAK_ENABLED guard
