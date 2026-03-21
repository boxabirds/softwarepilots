import { Hono } from "hono";
import type { Env } from "../env";
import {
  getCurriculumProfiles,
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";
import { getProgressForProfile } from "./curriculum-progress";
import {
  parseConceptsJson,
  getConceptsDueForReview,
} from "../lib/spaced-repetition";
import type { ConceptsMap } from "../lib/spaced-repetition";
import {
  buildNarrativePrompt,
  generateNarrative,
} from "../lib/narrative";
import type { ProgressStats, SectionProgressData } from "../lib/narrative";
import {
  compressConversation,
  persistSummary,
} from "../lib/context-assembly";

/* ---- Valid profiles and section ID pattern ---- */

const VALID_PROFILES = new Set([
  "level-0",
  "level-1",
  "level-10",
  "level-20",
]);

/** Section IDs follow the pattern "N.N" (e.g., "1.1", "2.3", "10.12") */
const SECTION_ID_PATTERN = /^\d+\.\d+$/;

/* ---- Validation helpers ---- */

export function isValidProfile(profile: string): boolean {
  return VALID_PROFILES.has(profile);
}

export function isValidSectionId(sectionId: string): boolean {
  return SECTION_ID_PATTERN.test(sectionId);
}

function validateProfileAndSection(
  profile: string,
  sectionId: string
): string | null {
  if (!isValidProfile(profile)) {
    return `Invalid profile: ${profile}`;
  }
  if (!isValidSectionId(sectionId)) {
    return `Invalid section_id: ${sectionId}`;
  }
  return null;
}

/* ---- Message type ---- */

interface ConversationMessage {
  role: "user" | "tutor";
  content: string;
}

/* ---- Route ---- */

const curriculum = new Hono<{ Bindings: Env }>();

/* GET / - list all curriculum profiles */
curriculum.get("/", (c) => {
  return c.json(getCurriculumProfiles());
});

/* GET /:profile - list sections for a profile */
curriculum.get("/:profile", (c) => {
  const profile = c.req.param("profile");
  try {
    return c.json(getCurriculumSections(profile));
  } catch {
    return c.json({ error: `Unknown profile: ${profile}` }, 404);
  }
});

/* GET /:profile/progress - learner's progress for all sections in a profile */
curriculum.get("/:profile/progress", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const profile = c.req.param("profile");
  const progress = await getProgressForProfile(c.env.DB, learnerId, profile);
  return c.json(progress);
});

/* ---- Narrative cache ---- */

const NARRATIVE_CACHE_TTL_MS = 3_600_000; // 1 hour

interface NarrativeCacheEntry {
  narrative: string;
  timestamp: number;
}

const narrativeCache = new Map<string, NarrativeCacheEntry>();

function getNarrativeCacheKey(
  learnerId: string,
  profile: string,
  latestUpdatedAt: string | null
): string {
  return `${learnerId}:${profile}:${latestUpdatedAt ?? "none"}`;
}

/** @internal Exposed for testing */
export function _clearNarrativeCache(): void {
  narrativeCache.clear();
}

/* GET /:profile/progress/summary - full progress summary with narrative */
curriculum.get("/:profile/progress/summary", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const profile = c.req.param("profile");

  if (!isValidProfile(profile)) {
    return c.json({ error: `Invalid profile: ${profile}` }, 400);
  }

  // Load all progress rows (with concepts_json for due-review calculation)
  const { results: rawRows } = await c.env.DB.prepare(
    `SELECT section_id, status, understanding_json, concepts_json, updated_at
     FROM curriculum_progress
     WHERE learner_id = ? AND profile = ?`
  )
    .bind(learnerId, profile)
    .all<{
      section_id: string;
      status: string;
      understanding_json: string;
      concepts_json: string | null;
      updated_at: string;
    }>();

  const rows = rawRows || [];

  // Build section lookup from curriculum
  let sectionLookup: Map<string, { title: string; module_id: string; module_title: string }>;
  try {
    const sections = getCurriculumSections(profile);
    sectionLookup = new Map(
      sections.map((s) => [s.id, { title: s.title, module_id: s.module_id, module_title: s.module_title }])
    );
  } catch {
    sectionLookup = new Map();
  }

  // Map progress rows by section_id
  const progressBySectionId = new Map(rows.map((r) => [r.section_id, r]));

  // Compute stats
  const totalSections = sectionLookup.size || rows.length;
  const statusCounts = { completed: 0, in_progress: 0, paused: 0, not_started: 0 };
  for (const row of rows) {
    if (row.status === "completed") statusCounts.completed++;
    else if (row.status === "in_progress") statusCounts.in_progress++;
    else if (row.status === "paused") statusCounts.paused++;
  }
  statusCounts.not_started = totalSections - statusCounts.completed - statusCounts.in_progress - statusCounts.paused;
  if (statusCounts.not_started < 0) statusCounts.not_started = 0;

  const stats: ProgressStats = { ...statusCounts, total: totalSections };

  // Build section progress data
  const sectionProgressData: SectionProgressData[] = [];
  for (const [sectionId, info] of sectionLookup) {
    const row = progressBySectionId.get(sectionId);
    const concepts: ConceptsMap = row ? parseConceptsJson(row.concepts_json) : {};
    const entries = row ? JSON.parse(row.understanding_json || "[]") : [];
    const latest = entries.length > 0 ? entries[entries.length - 1] : null;

    sectionProgressData.push({
      section_id: sectionId,
      title: info.title,
      status: row?.status ?? "not_started",
      understanding_level: latest?.understanding_level,
      concepts: Object.fromEntries(
        Object.entries(concepts).map(([name, a]) => [
          name,
          { level: a.level, review_count: a.review_count },
        ])
      ),
    });
  }

  // Concepts due for review
  const dueConcepts = getConceptsDueForReview(
    rows.map((r) => ({ section_id: r.section_id, concepts_json: r.concepts_json }))
  );

  // Generate or retrieve cached narrative
  const latestUpdatedAt = rows.length > 0
    ? rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), rows[0].updated_at)
    : null;

  let overallNarrative: string | null = null;

  if (rows.length > 0) {
    const cacheKey = getNarrativeCacheKey(learnerId, profile, latestUpdatedAt);
    const cached = narrativeCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < NARRATIVE_CACHE_TTL_MS) {
      overallNarrative = cached.narrative;
    } else {
      try {
        const prompt = buildNarrativePrompt(sectionProgressData, stats, dueConcepts.length);
        const model = c.env.GEMINI_MODEL ?? "gemini-2.0-flash";
        overallNarrative = await generateNarrative(c.env.GEMINI_API_KEY, model, prompt);
        narrativeCache.set(cacheKey, { narrative: overallNarrative, timestamp: now });
      } catch {
        // LLM failure is non-fatal
        overallNarrative = null;
      }
    }
  }

  return c.json({
    overall_narrative: overallNarrative,
    sections: sectionProgressData,
    stats,
    concepts_due_for_review: dueConcepts.map((d) => ({
      concept: d.concept,
      section_id: d.section_id,
      days_overdue: d.days_overdue,
    })),
  });
});

/* GET /:profile/:sectionId - get section with markdown (must be before conversation routes) */
curriculum.get("/:profile/:sectionId", (c) => {
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");
  try {
    return c.json(getSection(profile, sectionId));
  } catch {
    return c.json(
      { error: `Section "${sectionId}" not found for profile "${profile}"` },
      404,
    );
  }
});

/* PUT /:profile/:sectionId/conversation - save (upsert) conversation */
curriculum.put("/:profile/:sectionId/conversation", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");

  const validationError = validateProfileAndSection(profile, sectionId);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  let body: { messages: ConversationMessage[] };
  try {
    body = await c.req.json<{ messages: ConversationMessage[] }>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: "messages must be a non-empty array" }, 400);
  }

  // Check for existing active (non-archived) conversation
  const existing = await c.env.DB.prepare(
    `SELECT id FROM curriculum_conversations
     WHERE learner_id = ? AND profile = ? AND section_id = ? AND archived_at IS NULL`
  )
    .bind(learnerId, profile, sectionId)
    .first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE curriculum_conversations
       SET messages_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(JSON.stringify(body.messages), existing.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO curriculum_conversations (learner_id, profile, section_id, messages_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(learnerId, profile, sectionId, JSON.stringify(body.messages))
      .run();
  }

  return c.json({ saved: true });
});

/* GET /:profile/:sectionId/conversation - load conversation */
curriculum.get("/:profile/:sectionId/conversation", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");

  const validationError = validateProfileAndSection(profile, sectionId);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT messages_json, updated_at
     FROM curriculum_conversations
     WHERE learner_id = ? AND profile = ? AND section_id = ? AND archived_at IS NULL`
  )
    .bind(learnerId, profile, sectionId)
    .first<{ messages_json: string; updated_at: string }>();

  if (!row) {
    return c.json({ messages: [], updated_at: null });
  }

  return c.json({
    messages: JSON.parse(row.messages_json),
    updated_at: row.updated_at,
  });
});

/* DELETE /:profile/:sectionId/conversation - archive and reset conversation */
curriculum.delete("/:profile/:sectionId/conversation", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");

  const validationError = validateProfileAndSection(profile, sectionId);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  // Load the conversation before archiving so we can compress it
  const conv = await c.env.DB.prepare(
    `SELECT id, messages_json FROM curriculum_conversations
     WHERE learner_id = ? AND profile = ? AND section_id = ? AND archived_at IS NULL`
  )
    .bind(learnerId, profile, sectionId)
    .first<{ id: string; messages_json: string }>();

  await c.env.DB.prepare(
    `UPDATE curriculum_conversations
     SET archived_at = datetime('now')
     WHERE learner_id = ? AND profile = ? AND section_id = ? AND archived_at IS NULL`
  )
    .bind(learnerId, profile, sectionId)
    .run();

  // Fire-and-forget: compress the archived conversation
  if (conv) {
    let sectionTitle = sectionId;
    try {
      const sec = getSection(profile, sectionId);
      sectionTitle = sec.title;
    } catch { /* use sectionId as fallback */ }

    const messages = JSON.parse(conv.messages_json) as Array<{ role: "user" | "tutor"; content: string }>;
    compressConversation(c.env.GEMINI_API_KEY, c.env.GEMINI_MODEL || "gemini-2.0-flash", messages, sectionTitle)
      .then((summary) => {
        if (summary) {
          persistSummary(c.env.DB, conv.id, summary).catch(() => {});
        }
      })
      .catch(() => {});
  }

  return c.json({ reset: true });
});

export { curriculum };
