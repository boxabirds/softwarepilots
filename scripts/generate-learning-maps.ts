#!/usr/bin/env bun
/**
 * Generates SectionLearningMap data for all curriculum sections using Gemini API.
 *
 * Usage:
 *   bun run scripts/generate-learning-maps.ts                          # write to TypeScript files
 *   bun run scripts/generate-learning-maps.ts --profile level-0        # single profile
 *   bun run scripts/generate-learning-maps.ts --profile level-1 --section 1.1
 *   bun run scripts/generate-learning-maps.ts --db                     # write to D1 instead of files
 *   bun run scripts/generate-learning-maps.ts --db --env staging       # write to staging D1
 *
 * The --db flag writes to the learning_maps table in D1 keyed by content hash.
 * Sections with matching content hash in the DB are skipped.
 * The generation logic is shared with packages/api/src/lib/learning-map-generator.ts.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { join, resolve } from "path";
import {
  getCurriculumProfiles,
  getSection,
  getCurriculumSections,
  extractConcepts,
} from "../packages/shared/src/curricula";
import { validateLearningMap } from "../packages/shared/src/curricula/learning-map-validator";
import type { SectionLearningMap } from "../packages/shared/src/curricula";
import { computeContentHash } from "../packages/api/src/lib/learning-map-store";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const LEARNING_MAPS_DIR = join(PROJECT_ROOT, "packages/shared/src/curricula/learning-maps");
const DEV_VARS_PATH = join(PROJECT_ROOT, "packages/api/.dev.vars");

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 5;

// -- CLI args --
function parseArgs(): { profile?: string; section?: string; db: boolean; env?: string } {
  const args = process.argv.slice(2);
  const result: { profile?: string; section?: string; db: boolean; env?: string } = { db: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--profile" && args[i + 1]) {
      result.profile = args[++i];
    } else if (args[i] === "--section" && args[i + 1]) {
      result.section = args[++i];
    } else if (args[i] === "--db") {
      result.db = true;
    } else if (args[i] === "--env" && args[i + 1]) {
      result.env = args[++i];
    }
  }
  return result;
}

// -- API key --
function getApiKey(): string {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (existsSync(DEV_VARS_PATH)) {
    const content = readFileSync(DEV_VARS_PATH, "utf-8");
    const match = content.match(/^GEMINI_API_KEY=(.+)$/m);
    if (match) {
      return match[1].trim();
    }
  }
  throw new Error(
    "GEMINI_API_KEY not found. Set it in environment or packages/api/.dev.vars"
  );
}

// -- Prompt --
function buildPrompt(
  sectionId: string,
  markdown: string,
  keyIntuition: string,
  concepts: string[],
): string {
  return `You are an expert curriculum designer for a software engineering education platform called "Software Pilots". Your task is to generate a structured learning map for a curriculum section.

## Section ID: ${sectionId}

## Key Intuition
${keyIntuition}

## Concepts extracted from this section
${concepts.map((c) => `- ${c}`).join("\n")}

## Section Content
${markdown}

## Instructions

Generate a SectionLearningMap JSON object with the following structure. Be precise and specific - avoid vague language.

Rules:
- core_claims: exactly 3 to 7 claims. Each claim must have a unique id (format: "claim-N"), a clear statement, at least one concept from the section concepts list, and specific demonstration_criteria.
- CRITICAL: demonstration_criteria must be specific and actionable. NEVER use phrases like "understands", "knows", "is aware of", "familiar with", or "has knowledge of". Instead use phrases like "Can explain...", "Can identify...", "Can build...", "Can compare...", "Can diagnose...", etc.
- CRITICAL: Every concept from the section concepts list must appear in at least one claim's concepts array.
- key_misconceptions: 1 to 3 common misconceptions. Each must reference valid claim IDs in related_claims.
- key_intuition_decomposition: exactly 2 to 4 sub-insights that break down the key intuition. Each has a unique id (format: "insight-N"), a statement, and an order number starting from 1.
- prerequisites: list any prerequisite section IDs or concepts (can be empty array).

Return ONLY valid JSON matching this exact schema:
{
  "section_id": "${sectionId}",
  "generated_at": "<ISO timestamp>",
  "model_used": "${GEMINI_MODEL}",
  "prerequisites": ["string"],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "string",
      "concepts": ["string"],
      "demonstration_criteria": "string"
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "string",
      "correction": "string",
      "related_claims": ["claim-1"]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "string",
      "order": 1
    }
  ]
}`;
}

// -- Gemini API call --
async function callGemini(
  apiKey: string,
  prompt: string,
): Promise<SectionLearningMap> {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No text in Gemini response");
  }

  return JSON.parse(text) as SectionLearningMap;
}

// -- File generation --
function writeMapFile(
  profile: string,
  sectionId: string,
  map: SectionLearningMap,
): string {
  const profileDir = join(LEARNING_MAPS_DIR, profile);
  mkdirSync(profileDir, { recursive: true });

  const fileName = `${sectionId}.ts`;
  const filePath = join(profileDir, fileName);

  const content = `import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = ${JSON.stringify(map, null, 2)};
`;

  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// -- DB write (for --db mode) --
function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

function writeMapToD1(
  profile: string,
  sectionId: string,
  contentHash: string,
  map: SectionLearningMap,
  env?: string,
): void {
  const mapJson = JSON.stringify(map);
  const sql = `INSERT OR REPLACE INTO learning_maps (profile, section_id, content_hash, map_json, model_used) VALUES ('${escapeSql(profile)}', '${escapeSql(sectionId)}', '${escapeSql(contentHash)}', '${escapeSql(mapJson)}', '${escapeSql(map.model_used ?? GEMINI_MODEL)}');`;

  const tmpFile = join(PROJECT_ROOT, ".learning-map-tmp.sql");
  writeFileSync(tmpFile, sql, "utf-8");

  const envFlag = env ? `--env ${env}` : "";
  const remoteFlag = env ? "--remote" : "--local";

  try {
    execSync(
      `cd "${join(PROJECT_ROOT, "packages/api")}" && npx wrangler d1 execute softwarepilots-db ${remoteFlag} ${envFlag} --file="${tmpFile}"`,
      { stdio: "pipe" },
    );
  } finally {
    try { require("fs").unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

async function isMapInDB(
  profile: string,
  sectionId: string,
  contentHash: string,
  env?: string,
): Promise<boolean> {
  const sql = `SELECT count(*) as cnt FROM learning_maps WHERE profile = '${escapeSql(profile)}' AND section_id = '${escapeSql(sectionId)}' AND content_hash = '${escapeSql(contentHash)}';`;

  const envFlag = env ? `--env ${env}` : "";
  const remoteFlag = env ? "--remote" : "--local";

  try {
    const output = execSync(
      `cd "${join(PROJECT_ROOT, "packages/api")}" && npx wrangler d1 execute softwarepilots-db ${remoteFlag} ${envFlag} --command="${sql}" --json`,
      { stdio: "pipe" },
    ).toString();
    const parsed = JSON.parse(output);
    const cnt = parsed?.[0]?.results?.[0]?.cnt;
    return cnt > 0;
  } catch {
    return false;
  }
}

function regenerateBarrelIndex(): void {
  const imports: string[] = [];
  const registrations: string[] = [];

  const profileDirs = readdirSync(LEARNING_MAPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const profile of profileDirs) {
    const profileDir = join(LEARNING_MAPS_DIR, profile);
    const files = readdirSync(profileDir)
      .filter((f) => f.endsWith(".ts") && f !== "index.ts")
      .sort();

    for (const file of files) {
      const sectionId = file.replace(".ts", "");
      const varName = `${profile.replace(/-/g, "_")}_${sectionId.replace(/\./g, "_")}`;
      imports.push(
        `import { map as ${varName} } from "./${profile}/${sectionId}";`
      );
      registrations.push(
        `learningMapRegistry.set("${profile}:${sectionId}", ${varName});`
      );
    }
  }

  const content = `import type { SectionLearningMap } from "../../curricula";

${imports.join("\n")}

/**
 * Registry of generated learning maps, keyed by "profile:sectionId".
 * Auto-generated by scripts/generate-learning-maps.ts - do not edit manually.
 */
export const learningMapRegistry = new Map<string, SectionLearningMap>();

${registrations.join("\n")}

/**
 * Look up a learning map by section ID.
 * Searches across all profiles, returning the first match.
 * For profile-specific lookup, use the registry directly with "profile:sectionId" key.
 */
export function getLearningMap(sectionId: string): SectionLearningMap | undefined {
  // First try direct lookup (for backward compat with bare section IDs)
  for (const [key, value] of learningMapRegistry) {
    if (key.endsWith(":" + sectionId)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Look up a learning map by profile and section ID.
 */
export function getLearningMapForProfile(
  profile: string,
  sectionId: string,
): SectionLearningMap | undefined {
  return learningMapRegistry.get(profile + ":" + sectionId);
}
`;

  writeFileSync(join(LEARNING_MAPS_DIR, "index.ts"), content, "utf-8");
}

// -- Single section processing --
interface SectionTask {
  profile: string;
  sectionId: string;
}

interface SectionResult {
  task: SectionTask;
  status: "generated" | "failed" | "skipped";
}

async function processSection(
  apiKey: string,
  task: SectionTask,
  index: number,
  total: number,
  dbMode: boolean = false,
  env?: string,
): Promise<SectionResult> {
  const { profile, sectionId } = task;
  const existingFile = join(LEARNING_MAPS_DIR, profile, `${sectionId}.ts`);

  console.log(`Processing section ${index} of ${total} (${profile}/${sectionId})`);

  const section = getSection(profile, sectionId);
  const concepts = extractConcepts(section.markdown);

  // In DB mode, check content hash first and skip if unchanged
  if (dbMode) {
    const contentHash = await computeContentHash(section.markdown, section.key_intuition, concepts);
    const exists = await isMapInDB(profile, sectionId, contentHash, env);
    if (exists) {
      console.log(`  [${profile}/${sectionId}] Skipped (hash match in DB)`);
      return { task, status: "skipped" };
    }
  }

  const prompt = buildPrompt(sectionId, section.markdown, section.key_intuition, concepts);

  let map: SectionLearningMap | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`  [${profile}/${sectionId}] Retry ${attempt}/${MAX_RETRIES}...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }

    try {
      const candidate = await callGemini(apiKey, prompt);
      const validation = validateLearningMap(candidate, concepts);

      if (validation.valid) {
        map = candidate;
        break;
      } else {
        lastError = `Validation failed: ${validation.errors.join("; ")}`;
        console.log(`  [${profile}/${sectionId}] Validation errors: ${validation.errors.join("; ")}`);
      }
    } catch (err) {
      lastError = String(err);
      console.log(`  [${profile}/${sectionId}] API error: ${lastError}`);
    }
  }

  if (map) {
    if (dbMode) {
      const contentHash = await computeContentHash(section.markdown, section.key_intuition, concepts);
      writeMapToD1(profile, sectionId, contentHash, map, env);
      console.log(`  [${profile}/${sectionId}] Written to D1 (hash: ${contentHash.slice(0, 12)}...)`);
    } else {
      const filePath = writeMapFile(profile, sectionId, map);
      console.log(`  [${profile}/${sectionId}] Written to ${filePath}`);
    }
    return { task, status: "generated" };
  } else {
    console.log(`  [${profile}/${sectionId}] FAILED after ${MAX_RETRIES + 1} attempts: ${lastError}`);
    if (existsSync(existingFile)) {
      console.log(`  [${profile}/${sectionId}] Keeping existing valid file`);
      return { task, status: "skipped" };
    }
    return { task, status: "failed" };
  }
}

// -- Main --
async function main(): Promise<void> {
  const startTime = Date.now();
  const { profile: filterProfile, section: filterSection, db: dbMode, env: targetEnv } = parseArgs();
  const apiKey = getApiKey();

  console.log("Starting learning map generation...");
  console.log(`  Mode: ${dbMode ? "D1 database" : "TypeScript files"}`);
  if (filterProfile) console.log(`  Filtering to profile: ${filterProfile}`);
  if (filterSection) console.log(`  Filtering to section: ${filterSection}`);
  if (targetEnv) console.log(`  Target environment: ${targetEnv}`);

  // Collect all section tasks
  const tasks: SectionTask[] = [];
  const profiles = getCurriculumProfiles();

  for (const profileSummary of profiles) {
    const profile = profileSummary.profile;
    if (filterProfile && profile !== filterProfile) continue;

    const sections = getCurriculumSections(profile);
    for (const sectionSummary of sections) {
      if (filterSection && sectionSummary.id !== filterSection) continue;
      tasks.push({ profile, sectionId: sectionSummary.id });
    }
  }

  console.log(`\nFound ${tasks.length} sections to process in batches of ${BATCH_SIZE}\n`);

  let totalGenerated = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // Process in batches
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((task, batchIdx) =>
        processSection(apiKey, task, i + batchIdx + 1, tasks.length, dbMode, targetEnv)
      )
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        switch (result.value.status) {
          case "generated": totalGenerated++; break;
          case "failed": totalFailed++; break;
          case "skipped": totalSkipped++; break;
        }
      } else {
        // Promise rejected unexpectedly
        console.log(`  Unexpected batch error: ${result.reason}`);
        totalFailed++;
      }
    }
  }

  if (!dbMode) {
    console.log("\nRegenerating barrel index...");
    regenerateBarrelIndex();
  }

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsedSeconds}s!`);
  console.log(`  Generated: ${totalGenerated}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Skipped (existing kept): ${totalSkipped}`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
