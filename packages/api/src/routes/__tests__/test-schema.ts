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
        tutor_guidance: "",
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
