/**
 * Curriculum progress tracking - called after each Socratic chat exchange
 * to update the learner's section-level progress.
 */

import {
  updateConceptAssessment,
  parseConceptsJson,
  getConceptsDueForReview,
} from "../lib/spaced-repetition";
import type { ConceptsMap, ConceptUpdateOptions } from "../lib/spaced-repetition";
import { getCurriculumSections, getLearningMapForProfile, getLearningMap } from "@softwarepilots/shared";
import type { SectionLearningMap } from "@softwarepilots/shared";
import { getLearningMapFromDB } from "../lib/learning-map-store";
import { getVersionContentHash } from "../lib/curriculum-store";
import { getEnrollment } from "../lib/enrollment-store";

/**
 * Resolve a learning map: try DB first (keyed by enrollment's content hash),
 * fall back to static registry, then to null.
 *
 * DB lookup failures (e.g. tables not yet migrated) are silently caught
 * and fall through to the static registry.
 */
export async function resolveLearningMap(
  db: D1Database | null | undefined,
  profile: string,
  sectionId: string,
  learnerId?: string,
): Promise<SectionLearningMap | null> {
  // Try DB lookup via enrollment's content hash
  if (db && learnerId) {
    try {
      const enrollment = await getEnrollment(db, learnerId, profile);
      if (enrollment) {
        const contentHash = await getVersionContentHash(db, profile, enrollment.curriculum_version);
        if (contentHash) {
          const dbMap = await getLearningMapFromDB(db, profile, sectionId, contentHash);
          if (dbMap) return dbMap;
        }
      }
    } catch {
      // Fall through to static registry (e.g. tables not yet migrated)
    }
  }

  // Fall back to static registry (profile-specific only - cross-profile
  // fallback would apply wrong claims to wrong curriculum track)
  return getLearningMapForProfile(profile, sectionId) ?? null;
}

/* ---- Constants ---- */

const STATUS_NOT_STARTED = "not_started";
const STATUS_IN_PROGRESS = "in_progress";
const STATUS_COMPLETED = "completed";
export const STATUS_PAUSED = "paused";
export const STATUS_NEEDS_REVIEW = "needs_review";

const COMPLETION_TOOL_TYPE = "surface_key_insight";
const COMPLETION_READINESS = "articulated";
const SESSION_COMPLETE_TOOL_TYPE = "session_complete";
const PROVIDE_INSTRUCTION_TOOL_TYPE = "provide_instruction";
const SESSION_PAUSE_TOOL_TYPE = "session_pause";

/** Fraction of core claims that must be at or above MINIMUM_CLAIM_LEVEL to complete */
export const COMPLETION_THRESHOLD = 0.7;

/** Minimum claim level that counts as "demonstrated" for threshold purposes */
export const MINIMUM_CLAIM_LEVEL = "developing";

/** Ordinal ranking of claim levels - higher number = stronger demonstration */
export const LEVEL_ORDER: Record<string, number> = {
  emerging: 0,
  developing: 1,
  solid: 2,
  strong: 3,
};

/* ---- Types ---- */

export interface SocraticResponse {
  tool_type?: string;
  learner_readiness?: string;
  confidence_assessment?: string;
  understanding_level?: string;
  concepts_demonstrated?: string[];
  concept_levels?: string[];
  final_understanding?: string;
  concepts_covered?: string[];
  concepts_missed?: string[];
  struggle_reason?: string;
  concept?: string;
  pause_reason?: string;
  concepts_covered_so_far?: string;
  resume_suggestion?: string;
  claims_demonstrated?: string[];
  claim_levels?: string[];
  misconceptions_surfaced?: string[];
  misconceptions_resolved?: string[];
}

interface ProgressRow {
  learner_id: string;
  profile: string;
  section_id: string;
  status: string;
  understanding_json: string;
  concepts_json: string | null;
  claims_json: string | null;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  updated_at: string;
}

export interface ClaimProgressSummary {
  demonstrated: number;
  total: number;
  percentage: number;
  missing: string[];
}

export interface ProgressSummary {
  section_id: string;
  status: string;
  understanding_level?: string;
  concepts_json?: string | null;
  claim_progress?: ClaimProgressSummary;
  updated_at: string;
}

/* ---- Claim progress computation ---- */

export interface ClaimProgress {
  meets_threshold: boolean;
  percentage: number;
  demonstrated: number;
  total: number;
  missing_claims: string[];
}

/**
 * Compute how many core claims are demonstrated at or above MINIMUM_CLAIM_LEVEL.
 * Returns progress stats including whether the completion threshold is met.
 */
export function computeClaimProgress(
  claimsJson: string | null | undefined,
  learningMap: SectionLearningMap | null | undefined
): ClaimProgress {
  const NO_MAP_RESULT: ClaimProgress = {
    meets_threshold: true,
    percentage: 100,
    demonstrated: 0,
    total: 0,
    missing_claims: [],
  };

  if (!learningMap || learningMap.core_claims.length === 0) {
    return NO_MAP_RESULT;
  }

  let claimsMap: ClaimsMap;
  try {
    claimsMap = claimsJson ? JSON.parse(claimsJson) : {};
  } catch {
    claimsMap = {};
  }

  const minimumRank = LEVEL_ORDER[MINIMUM_CLAIM_LEVEL];
  const total = learningMap.core_claims.length;
  let demonstrated = 0;
  const missing: string[] = [];

  for (const claim of learningMap.core_claims) {
    const entry = claimsMap[claim.id];
    if (entry) {
      const rank = LEVEL_ORDER[entry.level] ?? -1;
      if (rank >= minimumRank) {
        demonstrated++;
        continue;
      }
    }
    missing.push(claim.id);
  }

  const percentage = total > 0 ? Math.round((demonstrated / total) * 100) : 100;

  return {
    meets_threshold: percentage >= COMPLETION_THRESHOLD * 100,
    percentage,
    demonstrated,
    total,
    missing_claims: missing,
  };
}

/* ---- Claim decay evaluation ---- */

/** Days overdue at which a claim's underlying concept triggers full removal */
const DECAY_REMOVE_DAYS = 7;

/** Days overdue range (1 to DECAY_REMOVE_DAYS-1) that triggers a one-tier downgrade */
const DECAY_DOWNGRADE_MIN_DAYS = 1;

/**
 * Evaluate claim decay based on spaced-repetition overdue concepts.
 * For each claim in the learning map, checks if any of its underlying concepts
 * are overdue for review. Returns a decayed copy of the claims map:
 * - Concept 1-6 days overdue: downgrade claim level by one tier
 * - Concept 7+ days overdue: remove claim from the map entirely
 */
export function evaluateClaimDecay(
  claimsJson: string | null | undefined,
  conceptsJson: string | null | undefined,
  learningMap: SectionLearningMap | null | undefined,
  now?: Date
): ClaimsMap {
  let claimsMap: ClaimsMap;
  try {
    claimsMap = claimsJson ? JSON.parse(claimsJson) : {};
  } catch {
    claimsMap = {};
  }

  if (!learningMap || learningMap.core_claims.length === 0) {
    return claimsMap;
  }

  const conceptsMap = parseConceptsJson(conceptsJson);
  const timestamp = now ?? new Date();
  const msPerDay = 86_400_000;

  // Build a copy so we don't mutate the original
  const decayed: ClaimsMap = { ...claimsMap };

  for (const claim of learningMap.core_claims) {
    const entry = decayed[claim.id];
    if (!entry) continue;

    // Check each concept tied to this claim
    let worstOverdueDays = 0;
    for (const conceptName of claim.concepts) {
      const assessment = conceptsMap[conceptName];
      if (!assessment) continue;

      const nextReview = new Date(assessment.next_review);
      if (nextReview <= timestamp) {
        const daysOverdue = Math.floor(
          (timestamp.getTime() - nextReview.getTime()) / msPerDay
        );
        worstOverdueDays = Math.max(worstOverdueDays, daysOverdue);
      }
    }

    if (worstOverdueDays >= DECAY_REMOVE_DAYS) {
      // Full removal - concept is too stale
      delete decayed[claim.id];
    } else if (worstOverdueDays >= DECAY_DOWNGRADE_MIN_DAYS) {
      // Downgrade by one tier
      const currentRank = LEVEL_ORDER[entry.level] ?? 0;
      const downgraded = currentRank - 1;
      // Find the level name for the downgraded rank
      const levelName = Object.entries(LEVEL_ORDER).find(([, rank]) => rank === downgraded)?.[0];
      if (levelName) {
        decayed[claim.id] = { ...entry, level: levelName };
      } else {
        // Already at lowest tier (emerging -> below emerging), remove
        delete decayed[claim.id];
      }
    }
  }

  return decayed;
}

/* ---- Helpers ---- */

interface CompletionContext {
  claimsJson?: string | null;
  learningMap?: SectionLearningMap | null;
}

function isCompletionTrigger(response: SocraticResponse, ctx?: CompletionContext): boolean {
  const isTutorComplete =
    response.tool_type === SESSION_COMPLETE_TOOL_TYPE ||
    (response.tool_type?.includes(SESSION_COMPLETE_TOOL_TYPE) ?? false);

  const isInsightComplete =
    response.tool_type === COMPLETION_TOOL_TYPE &&
    response.learner_readiness === COMPLETION_READINESS;

  if (!isTutorComplete && !isInsightComplete) return false;

  // If we have a learning map with claims, enforce the threshold
  if (ctx?.learningMap && ctx.learningMap.core_claims.length > 0) {
    const progress = computeClaimProgress(ctx.claimsJson, ctx.learningMap);
    if (!progress.meets_threshold) {
      console.log(
        `[progress] Completion override: claims at ${progress.percentage}%, threshold is ${COMPLETION_THRESHOLD * 100}%. ` +
        `Missing: ${progress.missing_claims.join(", ")}`
      );
      return false;
    }
  }

  return true;
}

function isPauseTrigger(response: SocraticResponse): boolean {
  if (!response.tool_type) return false;
  return response.tool_type === SESSION_PAUSE_TOOL_TYPE ||
    response.tool_type.includes(SESSION_PAUSE_TOOL_TYPE);
}

/* ---- Concept tracking helper ---- */

function applyConceptUpdates(
  existingJson: string | null | undefined,
  response: SocraticResponse
): ConceptsMap | null {
  const needsInstruction = response.tool_type?.includes(PROVIDE_INSTRUCTION_TOOL_TYPE) ?? false;
  const instructionConcept = response.concept;
  const instructionOptions: ConceptUpdateOptions | undefined = needsInstruction
    ? { needed_instruction: true, struggle_reason: response.struggle_reason }
    : undefined;

  // If provide_instruction was used but there are no tracked concepts,
  // create an entry for the instruction concept itself
  const concepts = response.concepts_demonstrated;
  const levels = response.concept_levels;

  let map = parseConceptsJson(existingJson);
  const now = new Date();

  if (concepts && concepts.length > 0) {
    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];
      const level = levels?.[i] ?? "emerging";
      const isInstructedConcept = needsInstruction && concept === instructionConcept;
      map = updateConceptAssessment(
        map, concept, level, now,
        isInstructedConcept ? instructionOptions : undefined
      );
    }
  }

  // If instruction was provided for a concept not already tracked, add it
  if (needsInstruction && instructionConcept && !map[instructionConcept]) {
    map = updateConceptAssessment(map, instructionConcept, "emerging", now, instructionOptions);
  }

  // Return null only if no changes were made
  const hasChanges = (concepts && concepts.length > 0) || (needsInstruction && instructionConcept);
  return hasChanges ? map : null;
}

/* ---- Claim tracking helper ---- */

export interface ClaimEntry {
  level: string;
  timestamp: string;
}

export type ClaimsMap = Record<string, ClaimEntry>;

const CLAIM_LEVEL_ORDER: Record<string, number> = {
  developing: 1,
  solid: 2,
  strong: 3,
};

export function applyClaimUpdates(
  existingJson: string | null | undefined,
  response: SocraticResponse
): ClaimsMap | null {
  const claims = response.claims_demonstrated;
  const levels = response.claim_levels;

  if (!claims || claims.length === 0) return null;

  let map: ClaimsMap;
  try {
    map = existingJson ? JSON.parse(existingJson) : {};
  } catch {
    map = {};
  }

  const now = new Date().toISOString();
  let changed = false;

  for (let i = 0; i < claims.length; i++) {
    const claimId = claims[i];
    const newLevel = levels?.[i] ?? "developing";
    const existing = map[claimId];

    // No downgrade: if existing level is higher, skip
    if (existing) {
      const existingRank = CLAIM_LEVEL_ORDER[existing.level] ?? 0;
      const newRank = CLAIM_LEVEL_ORDER[newLevel] ?? 0;
      if (newRank <= existingRank) continue;
    }

    map[claimId] = { level: newLevel, timestamp: now };
    changed = true;
  }

  return changed ? map : null;
}

/* ---- Core function ---- */

export async function updateSectionProgress(
  db: D1Database,
  learnerId: string,
  profile: string,
  sectionId: string,
  response: SocraticResponse
): Promise<void> {
  // Guard: verify learner exists before attempting writes that would violate FK constraint
  const learnerExists = await db
    .prepare("SELECT id FROM learners WHERE id = ?")
    .bind(learnerId)
    .first<{ id: string }>();

  if (!learnerExists) {
    console.warn(
      `[progress] Skipping write - learner not found: learner=${learnerId} section=${sectionId} profile=${profile}`
    );
    return;
  }

  // Load current progress
  const existing = await db
    .prepare(
      "SELECT * FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND section_id = ?"
    )
    .bind(learnerId, profile, sectionId)
    .first<ProgressRow>();

  // Look up learning map: try DB (content-hash keyed) first, then static registry.
  const sectionLearningMap = await resolveLearningMap(db, profile, sectionId, learnerId);

  if (!existing) {
    // First interaction - create row
    const understandingEntries: Array<Record<string, string | string[]>> = [];
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

    const claimsMap = applyClaimUpdates(null, response);
    const claimsJsonForCheck = claimsMap ? JSON.stringify(claimsMap) : null;
    const shouldComplete = isCompletionTrigger(response, {
      claimsJson: claimsJsonForCheck,
      learningMap: sectionLearningMap,
    });

    if (shouldComplete && response.tool_type === SESSION_COMPLETE_TOOL_TYPE) {
      understandingEntries.push({
        final_understanding: response.final_understanding ?? "developing",
        ...(response.concepts_covered ? { concepts_covered: response.concepts_covered } : {}),
        ...(response.concepts_missed ? { concepts_missed: response.concepts_missed } : {}),
        timestamp: new Date().toISOString(),
      });
    }

    const conceptsMap = applyConceptUpdates(null, response);

    await db
      .prepare(
        `INSERT INTO curriculum_progress (learner_id, profile, section_id, status, understanding_json, concepts_json, claims_json, started_at, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`
      )
      .bind(
        learnerId,
        profile,
        sectionId,
        shouldComplete ? STATUS_COMPLETED : STATUS_IN_PROGRESS,
        JSON.stringify(understandingEntries),
        conceptsMap ? JSON.stringify(conceptsMap) : "{}",
        claimsJsonForCheck ?? "{}",
        shouldComplete ? new Date().toISOString() : null
      )
      .run();
    return;
  }

  // Status never regresses from completed (pause also blocked from completed)
  if (existing.status === STATUS_COMPLETED) {
    // Still accumulate understanding, concept, and claim data even if completed
    const hasUnderstanding =
      response.confidence_assessment || response.understanding_level;
    const conceptsMap = applyConceptUpdates(existing.concepts_json, response);
    const claimsMap = applyClaimUpdates(existing.claims_json, response);

    if (hasUnderstanding || conceptsMap || claimsMap) {
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
          "UPDATE curriculum_progress SET understanding_json = ?, concepts_json = ?, claims_json = ?, updated_at = datetime('now') WHERE learner_id = ? AND profile = ? AND section_id = ?"
        )
        .bind(
          JSON.stringify(entries),
          conceptsMap
            ? JSON.stringify(conceptsMap)
            : existing.concepts_json ?? "{}",
          claimsMap
            ? JSON.stringify(claimsMap)
            : existing.claims_json ?? "{}",
          learnerId,
          profile,
          sectionId
        )
        .run();
    }
    return;
  }

  // Resume from paused: any non-pause interaction transitions back to in_progress
  if (existing.status === STATUS_PAUSED && !isPauseTrigger(response)) {
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
    const claimsMap = applyClaimUpdates(existing.claims_json, response);

    await db
      .prepare(
        `UPDATE curriculum_progress
         SET status = ?, understanding_json = ?, concepts_json = ?, claims_json = ?, updated_at = datetime('now')
         WHERE learner_id = ? AND profile = ? AND section_id = ?`
      )
      .bind(
        STATUS_IN_PROGRESS,
        JSON.stringify(entries),
        conceptsMap
          ? JSON.stringify(conceptsMap)
          : existing.concepts_json ?? "{}",
        claimsMap
          ? JSON.stringify(claimsMap)
          : existing.claims_json ?? "{}",
        learnerId,
        profile,
        sectionId
      )
      .run();
    return;
  }

  // Update existing in-progress (or paused) row
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
  const claimsMap = applyClaimUpdates(existing.claims_json, response);
  // Merge existing claims with any new claims for the threshold check
  const mergedClaimsJson = claimsMap
    ? JSON.stringify(claimsMap)
    : existing.claims_json ?? "{}";
  const shouldComplete = isCompletionTrigger(response, {
    claimsJson: mergedClaimsJson,
    learningMap: sectionLearningMap,
  });
  const shouldPause = isPauseTrigger(response);

  if (shouldComplete && response.tool_type?.includes(SESSION_COMPLETE_TOOL_TYPE)) {
    entries.push({
      final_understanding: response.final_understanding ?? "developing",
      ...(response.concepts_covered ? { concepts_covered: response.concepts_covered } : {}),
      ...(response.concepts_missed ? { concepts_missed: response.concepts_missed } : {}),
      timestamp: new Date().toISOString(),
    });
  }

  if (shouldPause) {
    entries.push({
      pause_reason: response.pause_reason ?? "learner_requested",
      ...(response.concepts_covered_so_far
        ? { concepts_covered_so_far: response.concepts_covered_so_far }
        : {}),
      ...(response.resume_suggestion
        ? { resume_suggestion: response.resume_suggestion }
        : {}),
      timestamp: new Date().toISOString(),
    });
  }

  let newStatus: string;
  if (shouldComplete) {
    newStatus = STATUS_COMPLETED;
  } else if (shouldPause && existing.status === STATUS_IN_PROGRESS) {
    newStatus = STATUS_PAUSED;
  } else {
    newStatus = existing.status;
  }

  await db
    .prepare(
      `UPDATE curriculum_progress
       SET status = ?, understanding_json = ?, concepts_json = ?, claims_json = ?, completed_at = ?, paused_at = ?, updated_at = datetime('now')
       WHERE learner_id = ? AND profile = ? AND section_id = ?`
    )
    .bind(
      newStatus,
      JSON.stringify(entries),
      conceptsMap
        ? JSON.stringify(conceptsMap)
        : existing.concepts_json ?? "{}",
      claimsMap
        ? JSON.stringify(claimsMap)
        : existing.claims_json ?? "{}",
      shouldComplete ? new Date().toISOString() : existing.completed_at,
      shouldPause ? new Date().toISOString() : existing.paused_at,
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
      "SELECT section_id, status, understanding_json, concepts_json, claims_json, updated_at FROM curriculum_progress WHERE learner_id = ? AND profile = ?"
    )
    .bind(learnerId, profile)
    .all<Pick<ProgressRow, "section_id" | "status" | "understanding_json" | "concepts_json" | "claims_json" | "updated_at">>();

  return Promise.all((results || []).map(async (row) => {
    const entries = JSON.parse(row.understanding_json || "[]") as Array<
      Record<string, string>
    >;
    const latest = entries.length > 0 ? entries[entries.length - 1] : null;
    const understandingLevel = latest?.understanding_level;

    // Compute claim progress: try DB first, then static registry
    const learningMap = await resolveLearningMap(db, profile, row.section_id, learnerId);

    // For completed sections, evaluate claim decay based on overdue concepts
    let effectiveClaimsJson = row.claims_json;
    let effectiveStatus = row.status;
    if (row.status === STATUS_COMPLETED && learningMap && learningMap.core_claims.length > 0) {
      const decayedClaims = evaluateClaimDecay(row.claims_json, row.concepts_json, learningMap);
      effectiveClaimsJson = JSON.stringify(decayedClaims);
      const decayedProgress = computeClaimProgress(effectiveClaimsJson, learningMap);
      if (!decayedProgress.meets_threshold) {
        effectiveStatus = STATUS_NEEDS_REVIEW;
      }
    }

    const claimProgress = computeClaimProgress(effectiveClaimsJson, learningMap);

    const summary: ProgressSummary = {
      section_id: row.section_id,
      status: effectiveStatus,
      updated_at: row.updated_at,
    };
    if (understandingLevel) {
      summary.understanding_level = understandingLevel;
    }
    if (row.concepts_json) {
      summary.concepts_json = row.concepts_json;
    }
    if (learningMap && learningMap.core_claims.length > 0) {
      summary.claim_progress = {
        demonstrated: claimProgress.demonstrated,
        total: claimProgress.total,
        percentage: claimProgress.percentage,
        missing: claimProgress.missing_claims,
      };
    }
    return summary;
  }));
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
      "SELECT section_id, status, understanding_json, concepts_json, claims_json FROM curriculum_progress WHERE learner_id = ? AND profile = ? AND status != ?"
    )
    .bind(learnerId, profile, STATUS_NOT_STARTED)
    .all<Pick<ProgressRow, "section_id" | "status" | "understanding_json" | "concepts_json" | "claims_json">>();

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
  const paused: string[] = [];

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

    // Build per-section concept mastery details
    const concepts = parseConceptsJson(row.concepts_json);
    const conceptDetails: string[] = [];
    for (const [conceptName, assessment] of Object.entries(concepts)) {
      let detail = `    - ${conceptName}: ${assessment.level}`;
      if (assessment.needed_instruction) {
        detail += " (needed direct instruction)";
      }
      conceptDetails.push(detail);
    }

    const conceptSuffix = conceptDetails.length > 0
      ? "\n  Concepts:\n" + conceptDetails.join("\n")
      : "";

    // Build claim coverage section when claims_json is present
    const claimsRaw = row.claims_json;
    let claimSuffix = "";
    if (claimsRaw && claimsRaw !== "{}") {
      try {
        const claimsMap = JSON.parse(claimsRaw) as Record<string, { level: string }>;
        const learningMap = await resolveLearningMap(db, profile, row.section_id, learnerId);
        if (learningMap && learningMap.core_claims.length > 0) {
          const demonstrated: string[] = [];
          const notYetDemonstrated: string[] = [];
          for (const claim of learningMap.core_claims) {
            const entry = claimsMap[claim.id];
            if (entry) {
              demonstrated.push(`${claim.id} (${entry.level})`);
            } else {
              notYetDemonstrated.push(claim.id);
            }
          }
          const claimLines: string[] = [];
          claimLines.push(`  Claim Coverage for Section ${row.section_id}:`);
          if (demonstrated.length > 0) {
            claimLines.push(`    Demonstrated: ${demonstrated.join(", ")}`);
          }
          if (notYetDemonstrated.length > 0) {
            claimLines.push(`    Not yet demonstrated: ${notYetDemonstrated.join(", ")}`);
          }
          claimSuffix = "\n" + claimLines.join("\n");
        }
      } catch {
        // Malformed claims_json - skip
      }
    }

    if (row.status === STATUS_COMPLETED) {
      completed.push(`Completed: ${label}${conceptSuffix}${claimSuffix}`);
    } else if (row.status === STATUS_PAUSED) {
      paused.push(`Paused: ${label}${conceptSuffix}${claimSuffix}`);
    } else if (row.status === STATUS_IN_PROGRESS) {
      inProgress.push(`In progress: ${label}${conceptSuffix}${claimSuffix}`);
    }
  }

  const lines = ["== Learner Progress =="];
  lines.push(...completed, ...inProgress, ...paused);

  // Add concepts due for spaced repetition review
  const dueConcepts = getConceptsDueForReview(
    results.map((r) => ({ section_id: r.section_id, concepts_json: r.concepts_json }))
  );
  if (dueConcepts.length > 0) {
    lines.push("");
    lines.push("== Concepts Due for Review ==");
    for (const due of dueConcepts) {
      const sectionTitle = sectionTitleMap.get(due.section_id) || due.section_id;
      lines.push(`- "${due.concept}" from section ${due.section_id} "${sectionTitle}" (${due.days_overdue} days overdue)`);
    }
  }

  return lines.join("\n");
}
