/**
 * Curriculum version management - soft-delete versioning adapted from prompt-manager.
 *
 * Each profile has versioned curriculum content. Publishing a new version
 * soft-deletes (marks deleted=1) the previous version and inserts a new row.
 * All versions are preserved for audit and for learners pinned to older versions.
 */

import type { CurriculumData, CurriculumMeta, SectionMeta } from "@softwarepilots/shared";
import { extractConcepts } from "@softwarepilots/shared";

/* ---- Types ---- */

export interface CurriculumVersion {
  id: string;
  profile: string;
  version: number;
  content_hash: string;
  deleted: number;
  created_at: string;
  created_by: string | null;
  reason: string | null;
}

/** CurriculumVersion with deserialized content */
export interface CurriculumVersionWithContent extends CurriculumVersion {
  content: CurriculumData;
}

/* ---- Version CRUD ---- */

/**
 * Publish a new curriculum version. Soft-deletes the previous active version.
 * Adapted from prompt-manager's savePrompt() pattern.
 */
export async function publishVersion(
  db: D1Database,
  profile: string,
  contentJson: string,
  contentHash: string,
  createdBy?: string,
  reason?: string,
): Promise<CurriculumVersion> {
  // Get current max version for this profile
  const current = await db
    .prepare(
      "SELECT MAX(version) as max_version FROM curriculum_versions WHERE profile = ?",
    )
    .bind(profile)
    .first<{ max_version: number | null }>();

  const newVersion = (current?.max_version ?? 0) + 1;

  // Mark old versions as deleted
  await db
    .prepare(
      "UPDATE curriculum_versions SET deleted = 1 WHERE profile = ? AND deleted = 0",
    )
    .bind(profile)
    .run();

  // Insert new version
  const result = await db
    .prepare(
      `INSERT INTO curriculum_versions (id, profile, version, content_json, content_hash, created_by, reason)
       VALUES (hex(randomblob(16)), ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      profile,
      newVersion,
      contentJson,
      contentHash,
      createdBy ?? null,
      reason ?? null,
    )
    .run();

  if (!result.success) {
    throw new Error(`Failed to publish curriculum version for profile ${profile}`);
  }

  // Return the created version (without content_json to keep response lean)
  const created = await db
    .prepare(
      `SELECT id, profile, version, content_hash, deleted, created_at, created_by, reason
       FROM curriculum_versions
       WHERE profile = ? AND version = ?`,
    )
    .bind(profile, newVersion)
    .first<CurriculumVersion>();

  if (!created) {
    throw new Error(`Failed to retrieve published version ${newVersion} for profile ${profile}`);
  }

  return created;
}

/**
 * Get the current (latest non-deleted) version number for a profile.
 * Returns null if no versions exist.
 */
export async function getCurrentVersion(
  db: D1Database,
  profile: string,
): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT MAX(version) as max_version
       FROM curriculum_versions
       WHERE profile = ? AND deleted = 0`,
    )
    .bind(profile)
    .first<{ max_version: number | null }>();

  return row?.max_version ?? null;
}

/**
 * Load curriculum content for a specific version.
 * Returns null if version not found or content is malformed.
 */
export async function loadCurriculumByVersion(
  db: D1Database,
  profile: string,
  version: number,
): Promise<CurriculumVersionWithContent | null> {
  const row = await db
    .prepare(
      `SELECT id, profile, version, content_json, content_hash, deleted, created_at, created_by, reason
       FROM curriculum_versions
       WHERE profile = ? AND version = ?`,
    )
    .bind(profile, version)
    .first<CurriculumVersion & { content_json: string }>();

  if (!row) return null;

  try {
    const content = JSON.parse(row.content_json) as CurriculumData;
    const { content_json: _raw, ...meta } = row;
    return { ...meta, content };
  } catch {
    console.warn(
      `Corrupt content_json for profile ${profile} version ${version}`,
    );
    return null;
  }
}

/**
 * Load curriculum content for a learner's pinned enrollment version.
 * Joins enrollment to curriculum_versions.
 * Returns null if enrollment or version not found.
 */
export async function loadCurriculumForEnrollment(
  db: D1Database,
  learnerId: string,
  profile: string,
): Promise<CurriculumVersionWithContent | null> {
  const row = await db
    .prepare(
      `SELECT cv.id, cv.profile, cv.version, cv.content_json, cv.content_hash,
              cv.deleted, cv.created_at, cv.created_by, cv.reason
       FROM enrollments e
       JOIN curriculum_versions cv ON cv.profile = e.profile AND cv.version = e.curriculum_version
       WHERE e.learner_id = ? AND e.profile = ?`,
    )
    .bind(learnerId, profile)
    .first<CurriculumVersion & { content_json: string }>();

  if (!row) return null;

  try {
    const content = JSON.parse(row.content_json) as CurriculumData;
    const { content_json: _raw, ...meta } = row;
    return { ...meta, content };
  } catch {
    console.warn(
      `Corrupt content_json for enrollment: learner ${learnerId}, profile ${profile}`,
    );
    return null;
  }
}

/**
 * Get version history for a profile, ordered newest first.
 * Does not include content_json (too large for listing).
 */
export async function getVersionHistory(
  db: D1Database,
  profile: string,
): Promise<CurriculumVersion[]> {
  const { results } = await db
    .prepare(
      `SELECT id, profile, version, content_hash, deleted, created_at, created_by, reason
       FROM curriculum_versions
       WHERE profile = ?
       ORDER BY version DESC`,
    )
    .bind(profile)
    .all<CurriculumVersion>();

  return results || [];
}

/**
 * Get the content hash for a specific version.
 * Useful for learning map lookups without loading full content.
 */
export async function getVersionContentHash(
  db: D1Database,
  profile: string,
  version: number,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT content_hash FROM curriculum_versions WHERE profile = ? AND version = ?`,
    )
    .bind(profile, version)
    .first<{ content_hash: string }>();

  return row?.content_hash ?? null;
}

/* ---- Content accessors (extract meta/sections from CurriculumData) ---- */

/**
 * Extract CurriculumMeta from versioned CurriculumData.
 */
export function extractMeta(data: CurriculumData): CurriculumMeta {
  return { ...data.meta };
}

/**
 * Extract all sections from versioned CurriculumData as SectionMeta[].
 * Adds module_id, module_title, and concepts (extracted from markdown).
 * learning_map is left undefined - resolved separately from the DB.
 */
export function extractSections(data: CurriculumData): SectionMeta[] {
  const sections: SectionMeta[] = [];
  for (const mod of data.modules) {
    for (const sec of mod.sections) {
      sections.push({
        id: sec.id,
        module_id: mod.id,
        module_title: mod.title,
        title: sec.title,
        markdown: sec.markdown,
        key_intuition: sec.key_intuition,
        concepts: extractConcepts(sec.markdown),
        ...(sec.simulation_scenarios && { simulation_scenarios: sec.simulation_scenarios }),
      });
    }
  }
  return sections;
}

/**
 * Find a single section by ID from versioned CurriculumData.
 * Returns null if not found.
 */
export function findSection(data: CurriculumData, sectionId: string): SectionMeta | null {
  for (const mod of data.modules) {
    for (const sec of mod.sections) {
      if (sec.id === sectionId) {
        return {
          id: sec.id,
          module_id: mod.id,
          module_title: mod.title,
          title: sec.title,
          markdown: sec.markdown,
          key_intuition: sec.key_intuition,
          concepts: extractConcepts(sec.markdown),
          ...(sec.simulation_scenarios && { simulation_scenarios: sec.simulation_scenarios }),
        };
      }
    }
  }
  return null;
}
