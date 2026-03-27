/**
 * Enrollment management - course-level entity per learner per profile.
 *
 * An enrollment pins a learner to a specific curriculum version and
 * holds the unified concepts map for cross-module spaced repetition.
 */

import { parseConceptsJson } from "./spaced-repetition";
import type { ConceptsMap } from "./spaced-repetition";
import type { SectionLearningMap } from "@softwarepilots/shared";

export interface Enrollment {
  id: string;
  learner_id: string;
  profile: string;
  curriculum_version: number;
  status: string;
  enrolled_at: string;
  updated_at: string;
}

/**
 * Get existing enrollment or create one pinned to the latest curriculum version.
 * Uses INSERT OR IGNORE + SELECT for idempotent creation under concurrent requests.
 */
export async function getOrCreateEnrollment(
  db: D1Database,
  learnerId: string,
  profile: string,
): Promise<Enrollment> {
  // Resolve latest version (fall back to 1 if no versions seeded yet)
  const versionRow = await db
    .prepare(
      `SELECT MAX(version) as max_version
       FROM curriculum_versions
       WHERE profile = ? AND deleted = 0`,
    )
    .bind(profile)
    .first<{ max_version: number | null }>();

  const latestVersion = versionRow?.max_version ?? 1;

  // INSERT OR IGNORE handles concurrent creation - only one wins
  await db
    .prepare(
      `INSERT OR IGNORE INTO enrollments (id, learner_id, profile, curriculum_version)
       VALUES (hex(randomblob(16)), ?, ?, ?)`,
    )
    .bind(learnerId, profile, latestVersion)
    .run();

  // Always SELECT to get the definitive row (whether just created or pre-existing)
  const enrollment = await db
    .prepare(
      `SELECT id, learner_id, profile, curriculum_version, status, enrolled_at, updated_at
       FROM enrollments
       WHERE learner_id = ? AND profile = ?`,
    )
    .bind(learnerId, profile)
    .first<Enrollment>();

  if (!enrollment) {
    throw new Error(
      `Failed to create or retrieve enrollment for learner ${learnerId}, profile ${profile}`,
    );
  }

  return enrollment;
}

/**
 * Get existing enrollment without creating one. Returns null if not enrolled.
 */
export async function getEnrollment(
  db: D1Database,
  learnerId: string,
  profile: string,
): Promise<Enrollment | null> {
  return db
    .prepare(
      `SELECT id, learner_id, profile, curriculum_version, status, enrolled_at, updated_at
       FROM enrollments
       WHERE learner_id = ? AND profile = ?`,
    )
    .bind(learnerId, profile)
    .first<Enrollment>();
}

/* ---- Enrollment-level concept tracking ---- */

/**
 * Read the unified concepts map from the enrollment.
 * Returns empty map if concepts_json is null or corrupt.
 */
export async function getEnrollmentConcepts(
  db: D1Database,
  enrollmentId: string,
): Promise<ConceptsMap> {
  const row = await db
    .prepare("SELECT concepts_json FROM enrollments WHERE id = ?")
    .bind(enrollmentId)
    .first<{ concepts_json: string | null }>();

  if (!row) return {};
  return parseConceptsJson(row.concepts_json);
}

/**
 * Write the unified concepts map back to the enrollment.
 * Also updates the updated_at timestamp.
 */
export async function updateEnrollmentConcepts(
  db: D1Database,
  enrollmentId: string,
  conceptsMap: ConceptsMap,
): Promise<void> {
  await db
    .prepare(
      "UPDATE enrollments SET concepts_json = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(JSON.stringify(conceptsMap), enrollmentId)
    .run();
}

/* ---- Topic coverage count ---- */

/**
 * Count unique concepts demonstrated vs total unique concepts across all learning maps.
 *
 * "Covered" = concept name appears as a key in conceptsMap (at any level).
 * "Total" = unique concept names across all claims in all learning maps.
 *
 * Pure function - no DB or side effects.
 */
export function countTopicsCovered(
  conceptsMap: ConceptsMap,
  learningMaps: SectionLearningMap[],
): { covered: number; total: number } {
  // Collect all unique concept names from all claims across all maps
  const allConcepts = new Set<string>();
  for (const map of learningMaps) {
    for (const claim of map.core_claims) {
      for (const concept of claim.concepts) {
        allConcepts.add(concept);
      }
    }
  }

  if (allConcepts.size === 0) {
    return { covered: 0, total: 0 };
  }

  // Count how many of those concepts appear in the learner's concepts map
  let covered = 0;
  for (const concept of allConcepts) {
    if (concept in conceptsMap) {
      covered++;
    }
  }

  return { covered, total: allConcepts.size };
}
