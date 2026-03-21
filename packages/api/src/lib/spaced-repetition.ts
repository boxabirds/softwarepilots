/**
 * Spaced repetition logic for concept-level tracking.
 *
 * Each concept is stored as a ConceptAssessment in a JSON map keyed by concept label.
 * When a learner demonstrates understanding at a given level, the assessment is
 * updated with a new review timestamp and the next review interval is calculated.
 */

/* ---- Constants ---- */

/** Base intervals (in days) for each understanding level */
const INTERVAL_DAYS: Record<string, number> = {
  emerging: 1,
  developing: 3,
  solid: 7,
  strong: 21,
};

const VALID_LEVELS = ["emerging", "developing", "solid", "strong"] as const;
export type UnderstandingLevel = (typeof VALID_LEVELS)[number];

/* ---- Types ---- */

export interface ConceptAssessment {
  level: UnderstandingLevel;
  last_reviewed: string; // ISO 8601 timestamp
  next_review: string; // ISO 8601 timestamp
  review_count: number;
}

export type ConceptsMap = Record<string, ConceptAssessment>;

/* ---- Helpers ---- */

function isValidLevel(level: string): level is UnderstandingLevel {
  return VALID_LEVELS.includes(level as UnderstandingLevel);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/* ---- Core function ---- */

/**
 * Update a concepts map with a new assessment for a single concept.
 * Returns a new map (does not mutate the input).
 *
 * If the concept already exists, the level is updated and the review count
 * increments. If the new level is higher than the existing level, the interval
 * resets to the new level's base interval. If same or lower, the interval
 * still updates based on the reported level.
 */
export function updateConceptAssessment(
  existing: ConceptsMap,
  concept: string,
  level: string,
  now?: Date
): ConceptsMap {
  const normalizedLevel = level.trim().toLowerCase();
  if (!isValidLevel(normalizedLevel)) {
    // Skip invalid levels silently - LLM output can be noisy
    return existing;
  }

  const timestamp = now ?? new Date();
  const isoNow = timestamp.toISOString();
  const intervalDays = INTERVAL_DAYS[normalizedLevel];
  const nextReview = addDays(timestamp, intervalDays).toISOString();

  const prev = existing[concept];
  const reviewCount = prev ? prev.review_count + 1 : 1;

  return {
    ...existing,
    [concept]: {
      level: normalizedLevel,
      last_reviewed: isoNow,
      next_review: nextReview,
      review_count: reviewCount,
    },
  };
}

/**
 * Parse a concepts_json string from the database into a ConceptsMap.
 */
export function parseConceptsJson(raw: string | null | undefined): ConceptsMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as ConceptsMap;
  } catch {
    return {};
  }
}
