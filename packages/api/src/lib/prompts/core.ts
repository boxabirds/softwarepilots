/**
 * Prompt store CRUD operations.
 *
 * Delete-first: no fallback defaults. If a prompt key is not in the DB,
 * getPrompt() throws. The seed script populates all keys.
 *
 * Adapted from /Users/julian/expts/prompt-manager/templates/core/prompts.ts
 */

import type { Prompt, SaveOptions } from "./types";

/**
 * Get the latest active version of a prompt by key.
 * Throws if the key does not exist in the database.
 */
export async function getPrompt(
  db: D1Database,
  key: string,
): Promise<Prompt> {
  const result = await db
    .prepare(
      `SELECT id, key, content, version, deleted, created_at, created_by, reason
       FROM prompts
       WHERE key = ? AND deleted = 0
       ORDER BY version DESC
       LIMIT 1`,
    )
    .bind(key)
    .first<Prompt>();

  if (!result) {
    throw new Error(
      `Prompt not found: "${key}". Run the seed script to populate prompts.`,
    );
  }

  return result;
}

/**
 * Save a new version of a prompt. Soft-deletes all previous versions.
 * If the key doesn't exist yet, creates version 1.
 */
export async function savePrompt(
  db: D1Database,
  key: string,
  content: string,
  options: SaveOptions = {},
): Promise<Prompt> {
  const { createdBy, reason } = options;

  // Get current max version for this key
  const current = await db
    .prepare("SELECT MAX(version) as max_version FROM prompts WHERE key = ?")
    .bind(key)
    .first<{ max_version: number | null }>();

  const newVersion = (current?.max_version ?? 0) + 1;

  // Soft-delete all active versions
  await db
    .prepare("UPDATE prompts SET deleted = 1 WHERE key = ? AND deleted = 0")
    .bind(key)
    .run();

  // Insert new version
  await db
    .prepare(
      `INSERT INTO prompts (key, content, version, created_by, reason)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(key, content, newVersion, createdBy ?? null, reason ?? null)
    .run();

  // Return the newly created row
  const created = await db
    .prepare(
      `SELECT id, key, content, version, deleted, created_at, created_by, reason
       FROM prompts
       WHERE key = ? AND version = ?`,
    )
    .bind(key, newVersion)
    .first<Prompt>();

  if (!created) {
    throw new Error(`Failed to save prompt: "${key}"`);
  }

  return created;
}

/**
 * List all current (non-deleted) prompts, ordered by key.
 */
export async function listPrompts(db: D1Database): Promise<Prompt[]> {
  const { results } = await db
    .prepare(
      `SELECT id, key, content, version, deleted, created_at, created_by, reason
       FROM prompts
       WHERE deleted = 0
       ORDER BY key`,
    )
    .all<Prompt>();

  return results || [];
}

/**
 * Get the full version history for a prompt key.
 * Returns all versions (including soft-deleted) ordered newest first.
 */
export async function getPromptHistory(
  db: D1Database,
  key: string,
): Promise<Prompt[]> {
  const { results } = await db
    .prepare(
      `SELECT id, key, content, version, deleted, created_at, created_by, reason
       FROM prompts
       WHERE key = ?
       ORDER BY version DESC`,
    )
    .bind(key)
    .all<Prompt>();

  return results || [];
}
