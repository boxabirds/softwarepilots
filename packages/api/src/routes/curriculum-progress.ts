/**
 * Curriculum progress tracking - called after each Socratic chat exchange
 * to update the learner's section-level progress.
 */

import { getCurriculumSections } from "@softwarepilots/shared";

/* ---- Constants ---- */

const STATUS_NOT_STARTED = "not_started";
const STATUS_IN_PROGRESS = "in_progress";
const STATUS_COMPLETED = "completed";

const COMPLETION_TOOL_TYPE = "surface_key_insight";
const COMPLETION_READINESS = "articulated";

/* ---- Types ---- */

export interface SocraticResponse {
  tool_type?: string;
  learner_readiness?: string;
  confidence_assessment?: string;
  understanding_level?: string;
}

interface ProgressRow {
  learner_id: string;
  profile: string;
  section_id: string;
  status: string;
  understanding_json: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface ProgressSummary {
  section_id: string;
  status: string;
  understanding_level?: string;
  updated_at: string;
}

/* ---- Core function ---- */

export async function updateSectionProgress(
  db: D1Database,
  learnerId: string,
  profile: string,
  sectionId: string,
  response: SocraticResponse
): Promise<void> {
  // Load current progress
  const existing = await db
    .prepare(
      "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
    )
    .bind(learnerId, profile, sectionId)
    .first<ProgressRow>();

  if (!existing) {
    // First interaction - create row
    const understandingEntries: Array<Record<string, string>> = [];
    if (response.confidence_assessment || response.understanding_level) {
      understandingEntries.push({
        ...(response.confidence_assessment
          ? { confidence_assessment: response.confidence_assessment }
          : {}),
        ...(response.understanding_level
          ? { understanding_level: response.understanding_level }
          : {}),
        timestamp: new Date().toISOString(),
      });
    }

    const shouldComplete =
      response.tool_type === COMPLETION_TOOL_TYPE &&
      response.learner_readiness === COMPLETION_READINESS;

    await db
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, started_at, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`
      )
      .bind(
        learnerId,
        profile,
        sectionId,
        shouldComplete ? STATUS_COMPLETED : STATUS_IN_PROGRESS,
        JSON.stringify(understandingEntries),
        shouldComplete ? new Date().toISOString() : null
      )
      .run();
    return;
  }

  // Status never regresses
  if (existing.status === STATUS_COMPLETED) {
    // Still accumulate understanding data even if completed
    if (response.confidence_assessment || response.understanding_level) {
      const entries = JSON.parse(existing.understanding_json || "[]");
      entries.push({
        ...(response.confidence_assessment
          ? { confidence_assessment: response.confidence_assessment }
          : {}),
        ...(response.understanding_level
          ? { understanding_level: response.understanding_level }
          : {}),
        timestamp: new Date().toISOString(),
      });
      await db
        .prepare(
          "UPDATE curriculum_progress SET understanding_json = ?, updated_at = datetime('now') WHERE learner_id = ? AND profile = ? AND section_id = ?"
        )
        .bind(JSON.stringify(entries), learnerId, profile, sectionId)
        .run();
    }
    return;
  }

  // Update existing in-progress row
  const entries = JSON.parse(existing.understanding_json || "[]");
  if (response.confidence_assessment || response.understanding_level) {
    entries.push({
      ...(response.confidence_assessment
        ? { confidence_assessment: response.confidence_assessment }
        : {}),
      ...(response.understanding_level
        ? { understanding_level: response.understanding_level }
        : {}),
      timestamp: new Date().toISOString(),
    });
  }

  const shouldComplete =
    response.tool_type === COMPLETION_TOOL_TYPE &&
    response.learner_readiness === COMPLETION_READINESS;

  const newStatus = shouldComplete ? STATUS_COMPLETED : existing.status;

  await db
    .prepare(
      `UPDATE curriculum_progress
       SET status = ?, understanding_json = ?, completed_at = ?, updated_at = datetime('now')
       WHERE learner_id = ? AND profile = ? AND section_id = ?`
    )
    .bind(
      newStatus,
      JSON.stringify(entries),
      shouldComplete ? new Date().toISOString() : existing.completed_at,
      learnerId,
      profile,
      sectionId
    )
    .run();
}

/* ---- Query helper for GET endpoint ---- */

export async function getProgressForProfile(
  db: D1Database,
  learnerId: string,
  profile: string
): Promise<ProgressSummary[]> {
  const { results } = await db
    .prepare(
      "SELECT section_id, status, understanding_json, updated_at FROM curriculum_progress WHERE learner_id = ? AND profile = ?"
    )
    .bind(learnerId, profile)
    .all<Pick<ProgressRow, "section_id" | "status" | "understanding_json" | "updated_at">>();

  return (results || []).map((row) => {
    const entries = JSON.parse(row.understanding_json || "[]") as Array<
      Record<string, string>
    >;
    const latest = entries.length > 0 ? entries[entries.length - 1] : null;
    const understandingLevel = latest?.understanding_level;

    const summary: ProgressSummary = {
      section_id: row.section_id,
      status: row.status,
      updated_at: row.updated_at,
    };
    if (understandingLevel) {
      summary.understanding_level = understandingLevel;
    }
    return summary;
  });
}

/* ---- Cross-session progress context for tutor prompt ---- */

/**
 * Builds a structured text summary of the learner's progress across all
 * sections in a curriculum profile, suitable for injection into the
 * Socratic tutor system prompt so the LLM has cross-session context.
 */
export async function buildProgressContext(
  db: D1Database,
  learnerId: string,
  profile: string
): Promise<string> {
  const { results } = await db
    .prepare(
      "SELECT section_id, status, understanding_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND status != ?"
    )
    .bind(learnerId, profile, STATUS_NOT_STARTED)
    .all<Pick<ProgressRow, "section_id" | "status" | "understanding_json">>();

  if (!results || results.length === 0) {
    return "";
  }

  // Build a lookup from section_id -> title using the curriculum registry
  let sectionTitleMap: Map<string, string>;
  try {
    const sections = getCurriculumSections(profile);
    sectionTitleMap = new Map(sections.map((s) => [s.id, s.title]));
  } catch {
    // If the profile is invalid, fall back to IDs only
    sectionTitleMap = new Map();
  }

  const completed: string[] = [];
  const inProgress: string[] = [];

  for (const row of results) {
    const title = sectionTitleMap.get(row.section_id) || row.section_id;
    const entries = JSON.parse(row.understanding_json || "[]") as Array<
      Record<string, string>
    >;
    const latest = entries.length > 0 ? entries[entries.length - 1] : null;
    const level = latest?.understanding_level;

    const label = level
      ? `Section ${row.section_id} "${title}" (${level} understanding)`
      : `Section ${row.section_id} "${title}"`;

    if (row.status === STATUS_COMPLETED) {
      completed.push(`Completed: ${label}`);
    } else if (row.status === STATUS_IN_PROGRESS) {
      inProgress.push(`In progress: ${label}`);
    }
  }

  const lines = ["== Learner Progress =="];
  lines.push(...completed, ...inProgress);

  return lines.join("\n");
}
