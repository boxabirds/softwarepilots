/**
 * Learning map DB storage and content hashing.
 *
 * Maps are keyed by (profile, section_id, content_hash) so multiple
 * versions of a section's map coexist when curriculum content changes.
 */

import type { SectionLearningMap } from "@softwarepilots/shared";

/* ---- Content hashing ---- */

/**
 * Compute a SHA-256 hex digest of the inputs that define a learning map.
 * Same inputs always produce the same hash.
 */
export async function computeContentHash(
  markdown: string,
  keyIntuition: string,
  concepts: string[],
): Promise<string> {
  const input = markdown + "\0" + keyIntuition + "\0" + JSON.stringify(concepts);
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---- DB operations ---- */

/**
 * Look up a learning map by (profile, section_id, content_hash).
 * Returns null if not found.
 */
export async function getLearningMapFromDB(
  db: D1Database,
  profile: string,
  sectionId: string,
  contentHash: string,
): Promise<SectionLearningMap | null> {
  const row = await db
    .prepare(
      `SELECT map_json FROM learning_maps
       WHERE profile = ? AND section_id = ? AND content_hash = ?`,
    )
    .bind(profile, sectionId, contentHash)
    .first<{ map_json: string }>();

  if (!row) return null;

  try {
    return JSON.parse(row.map_json) as SectionLearningMap;
  } catch {
    console.warn(
      `Corrupt map_json for ${profile}:${sectionId} hash ${contentHash.slice(0, 12)}`,
    );
    return null;
  }
}

/**
 * Store a learning map in the DB.
 * Uses INSERT OR REPLACE so re-generating for the same content hash overwrites.
 */
export async function storeLearningMap(
  db: D1Database,
  profile: string,
  sectionId: string,
  contentHash: string,
  map: SectionLearningMap,
  modelUsed: string,
): Promise<void> {
  const mapJson = JSON.stringify(map);

  await db
    .prepare(
      `INSERT OR REPLACE INTO learning_maps (profile, section_id, content_hash, map_json, model_used)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(profile, sectionId, contentHash, mapJson, modelUsed)
    .run();
}
