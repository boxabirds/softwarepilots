import { Hono } from "hono";
import type { Env } from "../env";
import {
  getCurriculumProfiles,
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";
import { getProgressForProfile } from "./curriculum-progress";

/* ---- Valid profiles and section ID pattern ---- */

const VALID_PROFILES = new Set([
  "new-grad",
  "veteran-engineer",
  "senior-tech-leader",
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

  await c.env.DB.prepare(
    `INSERT INTO curriculum_conversations (learner_id, profile, section_id, messages_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT (learner_id, profile, section_id)
     DO UPDATE SET messages_json = excluded.messages_json, updated_at = datetime('now')`
  )
    .bind(learnerId, profile, sectionId, JSON.stringify(body.messages))
    .run();

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
     WHERE learner_id = ? AND profile = ? AND section_id = ?`
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

/* DELETE /:profile/:sectionId/conversation - reset conversation */
curriculum.delete("/:profile/:sectionId/conversation", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");

  const validationError = validateProfileAndSection(profile, sectionId);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  await c.env.DB.prepare(
    `DELETE FROM curriculum_conversations
     WHERE learner_id = ? AND profile = ? AND section_id = ?`
  )
    .bind(learnerId, profile, sectionId)
    .run();

  return c.json({ reset: true });
});

export { curriculum };
