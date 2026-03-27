/**
 * Shared SQL and seed helpers for test database setup.
 * Ensures all tables the route handlers expect are present and seeded.
 */

import type { Database } from "bun:sqlite";
import {
  getCurriculumProfiles,
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";
import type { CurriculumData } from "@softwarepilots/shared";

/** Tables added by Stories 60-62 (enrollment, versioning, learning maps) */
export const ENROLLMENT_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS curriculum_versions (
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
  CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    learner_id TEXT NOT NULL,
    profile TEXT NOT NULL,
    curriculum_version INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    concepts_json TEXT,
    enrolled_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE (learner_id, profile)
  );
  CREATE TABLE IF NOT EXISTS prompts (
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
  CREATE TABLE IF NOT EXISTS learning_maps (
    profile TEXT NOT NULL,
    section_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    map_json TEXT NOT NULL,
    model_used TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (profile, section_id, content_hash)
  );
`;

/**
 * Seed curriculum_versions with v1 data from compiled TypeScript for all profiles.
 * Call after creating tables and before running route handler tests.
 */
export function seedCurriculumVersions(sqliteDb: InstanceType<typeof Database>): void {
  const profiles = getCurriculumProfiles();
  for (const p of profiles) {
    // Build CurriculumData by reading sections
    const sections = getCurriculumSections(p.profile);
    const sectionsByModule = new Map<string, { id: string; title: string; sections: Array<{ id: string; title: string; key_intuition: string; markdown: string; simulation_scenarios?: string[] }> }>();

    for (const sec of sections) {
      const full = getSection(p.profile, sec.id);
      if (!sectionsByModule.has(sec.module_id)) {
        sectionsByModule.set(sec.module_id, { id: sec.module_id, title: sec.module_title, sections: [] });
      }
      sectionsByModule.get(sec.module_id)!.sections.push({
        id: full.id,
        title: full.title,
        key_intuition: full.key_intuition,
        markdown: full.markdown,
        ...(full.simulation_scenarios && { simulation_scenarios: full.simulation_scenarios }),
      });
    }

    const data: CurriculumData = {
      meta: {
        profile: p.profile as "level-0" | "level-1" | "level-10" | "level-20",
        title: p.title,
        starting_position: p.starting_position,
      },
      modules: Array.from(sectionsByModule.values()),
    };

    const contentJson = JSON.stringify(data);
    const contentHash = `test-hash-${p.profile}`;

    sqliteDb.prepare(
      `INSERT OR IGNORE INTO curriculum_versions (id, profile, version, content_json, content_hash, created_by, reason)
       VALUES (?, ?, 1, ?, ?, 'test', 'test seed')`
    ).run(`cv-${p.profile}`, p.profile, contentJson, contentHash);
  }
}

/* ---- Prompt test constants and seeding ---- */

export const TEST_TUTOR_GUIDANCE = `The learner is a complete beginner. Use simple, concrete language. Avoid jargon. Build understanding through real-world analogies.`;

export const TEST_SOCRATIC_PERSONA = `You are a Socratic tutor for "{{section_title}}" in the {{profile}} software pilotry curriculum.`;

export const TEST_SOCRATIC_RULES = `- NEVER refer to the learner in third person ('the learner', 'the student'). Always address them directly as 'you'. Your responses are spoken TO the learner, not ABOUT them.
- When creating scenarios, be internally consistent. Do not describe something as 'comprehensive' if the details contradict that (e.g., do not say 'comprehensive test suite' then mention only 15 unit tests for a complex service).
- Maximum {{max_response_sentences}} sentences per response (except provide_instruction, which should be as thorough as needed to explain the concept clearly)
- ALWAYS acknowledge the learner's previous message before asking the next question. Reference what they said, validate correct thinking, or gently note misconceptions. Never ignore what they wrote.
- Default to Socratic questioning. Only switch to direct instruction (provide_instruction) when questioning demonstrably isn't working.
- You MUST call one or more of the provided functions
- Use socratic_probe to ask probing questions
- Use present_scenario to illustrate with realistic examples
- Use evaluate_response when the learner provides an answer
- Use surface_key_insight when the learner is approaching the key intuition
- Use provide_instruction ONLY when Socratic questioning has demonstrably failed: the learner said 'I don't know', gave the same wrong answer multiple times, or shows no progression after several turns of low confidence. When providing instruction, include: (1) what the concept is, (2) why it matters in practice, (3) a concrete example. Then follow up with a question to check understanding.
- Use off_topic_detected to redirect off-topic messages
- Use session_complete when all key concepts in the section have been covered and the learner has demonstrated understanding of the key insight. Include a summary and list of concepts covered.
- Use session_pause when the learner explicitly asks to stop or take a break, shows signs of frustration, or appears fatigued. Be warm and encouraging. Never say 'you seem tired'. If the learner declines a pause offer, do not offer again for at least 5 more exchanges.
- Use lesson_query when the learner asks about the learning process itself:
  - 'What are the learning objectives?' / 'What's the point of this section?'
  - 'What topics haven't I covered?' / 'What's left?'
  - 'What needs more attention?' / 'What should I review?'
  - 'How am I doing?' / 'How much have I covered?'
  Answer using the concept list, the learner's demonstrated coverage, and the spaced repetition schedule. Be honest and specific.`;

export const TEST_REVIEW_PERSONA = `You are a Socratic tutor conducting a brief review session for the {{profile}} software pilotry curriculum.

== Review Session Rules ==
You are reviewing concepts the learner demonstrated previously but has not revisited recently.
Your goal is to PROBE FOR RECALL, not teach new material.
- Ask targeted questions to verify the learner still understands each concept
- If they demonstrate recall, acknowledge it and move to the next concept
- If they struggle, give a brief reminder and re-probe
- Keep the session brief: 2-5 exchanges total
- Use the track_concepts tool to update concept mastery levels
- Use the claim_assessment tool if claims are relevant
- When all overdue concepts have been addressed, call session_complete

== Response Rules ==
- ALWAYS use 'you/your' to address the learner directly
- NEVER refer to the learner in third person
- Keep responses to 1-3 sentences
- ALWAYS acknowledge the learner's previous message before asking the next question`;

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Seed the prompts table with prompt keys needed by route handler tests.
 * Call after creating tables for tests that hit the socratic route.
 */
const TEST_SUMMARIZATION_INSTRUCTIONS = `You are summarizing a tutoring conversation for future context.
Preserve the following in your summary:
- Topics discussed and key questions asked
- Concepts the learner understood well
- Concepts the learner struggled with
- Key insights or breakthroughs
- Where the conversation left off

Write a concise paragraph (3-5 sentences). Do not use bullet points.`;

export function seedPrompts(sqliteDb: InstanceType<typeof Database>): void {
  const prompts = [
    { key: "socratic.persona", content: TEST_SOCRATIC_PERSONA },
    { key: "socratic.rules", content: TEST_SOCRATIC_RULES },
    { key: "review.persona", content: TEST_REVIEW_PERSONA },
    { key: "summarization.instructions", content: TEST_SUMMARIZATION_INSTRUCTIONS },
    { key: "tutor_guidance.level-0", content: TEST_TUTOR_GUIDANCE },
    { key: "tutor_guidance.level-1", content: TEST_TUTOR_GUIDANCE },
    { key: "tutor_guidance.level-10", content: TEST_TUTOR_GUIDANCE },
    { key: "tutor_guidance.level-20", content: TEST_TUTOR_GUIDANCE },
    { key: "learning_map.generation", content: "Generate a learning map for {{section_id}}. Key intuition: {{key_intuition}}. Concepts: {{concepts_list}}. Content: {{markdown}}. Model: {{model}}. Return JSON." },
  ];
  for (const p of prompts) {
    sqliteDb.prepare(
      `INSERT OR IGNORE INTO prompts (key, content, version, created_by, reason)
       VALUES (?, ?, 1, 'test', 'test seed')`
    ).run(p.key, p.content);
  }
}
