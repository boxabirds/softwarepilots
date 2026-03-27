#!/usr/bin/env bun
/**
 * Seeds curriculum_versions (v1) and enrollments from existing progress data.
 *
 * Usage:
 *   bun run scripts/seed-curriculum.ts              # outputs SQL to stdout
 *   bun run scripts/seed-curriculum.ts --apply       # applies to local D1 via wrangler
 *   bun run scripts/seed-curriculum.ts --apply --env staging  # applies to staging
 */

import { resolve } from "path";
import { execSync } from "child_process";

import {
  getCurriculumProfiles,
} from "../packages/shared/src/curricula";

// Import raw curriculum data for serialization
import { level0Curriculum } from "../packages/shared/src/curricula/level-0";
import { newGradCurriculum } from "../packages/shared/src/curricula/new-grad";
import { veteranCurriculum } from "../packages/shared/src/curricula/veteran";
import { seniorLeaderCurriculum } from "../packages/shared/src/curricula/senior-leader";

import type { CurriculumData } from "../packages/shared/src/curricula";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const API_DIR = resolve(PROJECT_ROOT, "packages/api");

/* ---- CLI args ---- */

function parseArgs(): { apply: boolean; env?: string } {
  const args = process.argv.slice(2);
  let apply = false;
  let env: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") apply = true;
    if (args[i] === "--env" && args[i + 1]) env = args[++i];
  }
  return { apply, env };
}

/* ---- Content hash ---- */

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---- Profile -> data mapping ---- */

const PROFILE_DATA: Record<string, CurriculumData> = {
  "level-0": level0Curriculum,
  "level-1": newGradCurriculum,
  "level-10": veteranCurriculum,
  "level-20": seniorLeaderCurriculum,
};

/* ---- SQL escaping ---- */

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

/* ---- Main ---- */

async function main() {
  const { apply, env } = parseArgs();
  const statements: string[] = [];

  // 1. Seed curriculum_versions (v1 per profile)
  const profiles = getCurriculumProfiles();
  console.error(`Seeding ${profiles.length} curriculum profiles as version 1...`);

  for (const profile of profiles) {
    const data = PROFILE_DATA[profile.profile];
    if (!data) {
      console.error(`  SKIP: no data for profile ${profile.profile}`);
      continue;
    }

    const contentJson = JSON.stringify(data);
    const contentHash = await computeHash(contentJson);

    statements.push(
      `INSERT OR IGNORE INTO curriculum_versions (id, profile, version, content_json, content_hash, created_by, reason)` +
      ` VALUES (hex(randomblob(16)), '${escapeSql(profile.profile)}', 1, '${escapeSql(contentJson)}', '${contentHash}', 'seed-script', 'Initial seed from compiled TypeScript content');`
    );

    console.error(`  ${profile.profile}: ${contentHash.slice(0, 12)}... (${contentJson.length} bytes)`);
  }

  // 2. Backfill enrollments from existing curriculum_progress
  statements.push(
    `INSERT OR IGNORE INTO enrollments (id, learner_id, profile, curriculum_version)` +
    ` SELECT hex(randomblob(16)), learner_id, profile, 1` +
    ` FROM (SELECT DISTINCT learner_id, profile FROM curriculum_progress);`
  );

  const sql = statements.join("\n");

  if (apply) {
    console.error("\nApplying to D1...");
    const envFlag = env ? `--env ${env}` : "";
    const remoteFlag = env ? "--remote" : "--local";

    // Write SQL to temp file (avoids shell escaping issues with large JSON)
    const tmpFile = resolve(PROJECT_ROOT, ".seed-curriculum-tmp.sql");
    await Bun.write(tmpFile, sql);

    try {
      const cmd = `cd "${API_DIR}" && npx wrangler d1 execute softwarepilots-db ${remoteFlag} ${envFlag} --file="${tmpFile}"`;
      execSync(cmd, { stdio: "inherit" });
      console.error("\nSeed complete.");
    } finally {
      // Clean up temp file
      const fs = await import("fs");
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  } else {
    // Output SQL to stdout for inspection
    console.log(sql);
    console.error("\nDry run. Use --apply to execute against local D1.");
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
