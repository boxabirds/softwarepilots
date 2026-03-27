/**
 * Enrollment management - course-level entity per learner per profile.
 *
 * An enrollment pins a learner to a specific curriculum version.
 * Created on first section start, reused for all subsequent sections.
 */

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
