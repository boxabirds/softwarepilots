/**
 * Curriculum progress tracking - called after each Socratic chat exchange
 * to update the learner's section-level progress.
 */

import {
  updateConceptAssessment,
  parseConceptsJson,
} from "../lib/spaced-repetition";
import type { ConceptsMap } from "../lib/spaced-repetition";

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
  concepts_demonstrated?: string[];
  concept_levels?: string[];
}

interface ProgressRow {
  learner_id: string;
  profile: string;
  section_id: string;
  status: string;
  understanding_json: string;
  concepts_json: string | null;
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

/* ---- Concept tracking helper ---- */

function applyConceptUpdates(
  existingJson: string | null | undefined,
  response: SocraticResponse
): ConceptsMap | null {
  const concepts = response.concepts_demonstrated;
  const levels = response.concept_levels;
  if (!concepts || concepts.length === 0) return null;

  let map = parseConceptsJson(existingJson);
  const now = new Date();
  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    const level = levels?.[i] ?? "emerging";
    map = updateConceptAssessment(map, concept, level, now);
  }
  return map;
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

    const conceptsMap = applyConceptUpdates(null, response);

    await db
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, started_at, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`
      )
      .bind(
        learnerId,
        profile,
        sectionId,
        shouldComplete ? STATUS_COMPLETED : STATUS_IN_PROGRESS,
        JSON.stringify(understandingEntries),
        conceptsMap ? JSON.stringify(conceptsMap) : "{}",
        shouldComplete ? new Date().toISOString() : null
      )
      .run();
    return;
  }

  // Status never regresses
  if (existing.status === STATUS_COMPLETED) {
    // Still accumulate understanding and concept data even if completed
    const hasUnderstanding =
      response.confidence_assessment || response.understanding_level;
    const conceptsMap = applyConceptUpdates(existing.concepts_json, response);

    if (hasUnderstanding || conceptsMap) {
      const entries = JSON.parse(existing.understanding_json || "[]");
      if (hasUnderstanding) {
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
      await db
        .prepare(
          "UPDATE curriculum_progress SET understanding_json = ?, concepts_json = ?, updated_at = datetime('now') WHERE learner_id = ? AND profile = ? AND section_id = ?"
        )
        .bind(
          JSON.stringify(entries),
          conceptsMap
            ? JSON.stringify(conceptsMap)
            : existing.concepts_json ?? "{}",
          learnerId,
          profile,
          sectionId
        )
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

  const conceptsMap = applyConceptUpdates(existing.concepts_json, response);

  const shouldComplete =
    response.tool_type === COMPLETION_TOOL_TYPE &&
    response.learner_readiness === COMPLETION_READINESS;

  const newStatus = shouldComplete ? STATUS_COMPLETED : existing.status;

  await db
    .prepare(
      `UPDATE curriculum_progress
       SET status = ?, understanding_json = ?, concepts_json = ?, completed_at = ?, updated_at = datetime('now')
       WHERE learner_id = ? AND profile = ? AND section_id = ?`
    )
    .bind(
      newStatus,
      JSON.stringify(entries),
      conceptsMap
        ? JSON.stringify(conceptsMap)
        : existing.concepts_json ?? "{}",
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
