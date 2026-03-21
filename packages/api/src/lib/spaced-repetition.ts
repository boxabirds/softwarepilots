export interface ConceptAssessment {
  understanding_level: string; // emerging, developing, solid, strong
  last_assessed: string; // ISO timestamp
  review_interval_days: number;
  needed_instruction: boolean;
}

export interface ConceptReview {
  concept: string;
  last_assessed: string;
  understanding_level: string;
  days_overdue: number;
}

const LEVEL_INTERVALS: Record<string, number> = {
  emerging: 1,
  developing: 3,
  solid: 7,
  strong: 14,
};

const DEFAULT_INTERVAL_DAYS = 1;
const INSTRUCTION_PENALTY_FACTOR = 0.5;
const EASINESS_FACTOR = 2.0;
const RESET_INTERVAL_DAYS = 1;
const MS_PER_DAY = 86_400_000;

const LEVEL_ORDER: Record<string, number> = {
  emerging: 0,
  developing: 1,
  solid: 2,
  strong: 3,
};

/**
 * Returns interval in days until next review using simplified SM-2.
 * If needed_instruction is true, the interval is halved.
 * Unknown levels default to 1 day.
 */
export function calculateNextReview(
  understanding_level: string,
  needed_instruction: boolean,
): number {
  const base = LEVEL_INTERVALS[understanding_level] ?? DEFAULT_INTERVAL_DAYS;
  return needed_instruction ? base * INSTRUCTION_PENALTY_FACTOR : base;
}

/**
 * Returns concepts past their review date, sorted by days_overdue descending.
 */
export function getConceptsDueForReview(
  conceptsJson: Record<string, ConceptAssessment>,
  now: Date = new Date(),
): ConceptReview[] {
  const nowMs = now.getTime();
  const due: ConceptReview[] = [];

  for (const [concept, assessment] of Object.entries(conceptsJson)) {
    const lastAssessedMs = new Date(assessment.last_assessed).getTime();
    const reviewDateMs =
      lastAssessedMs + assessment.review_interval_days * MS_PER_DAY;

    if (reviewDateMs <= nowMs) {
      const daysOverdue = Math.floor((nowMs - reviewDateMs) / MS_PER_DAY);
      due.push({
        concept,
        last_assessed: assessment.last_assessed,
        understanding_level: assessment.understanding_level,
        days_overdue: daysOverdue,
      });
    }
  }

  due.sort((a, b) => b.days_overdue - a.days_overdue);
  return due;
}

/**
 * Updates a concept's assessment data with SM-2 inspired logic.
 * - Regression resets interval to 1 day.
 * - Maintained or improved understanding doubles the interval.
 * - New concepts get their initial interval from calculateNextReview.
 */
export function updateConceptAssessment(
  conceptsJson: Record<string, ConceptAssessment>,
  concept: string,
  understanding_level: string,
  needed_instruction: boolean,
): Record<string, ConceptAssessment> {
  const updated = { ...conceptsJson };
  const existing = updated[concept];
  const now = new Date().toISOString();

  if (existing) {
    const oldOrder = LEVEL_ORDER[existing.understanding_level] ?? 0;
    const newOrder = LEVEL_ORDER[understanding_level] ?? 0;

    const regressed = newOrder < oldOrder;
    const interval = regressed
      ? RESET_INTERVAL_DAYS
      : existing.review_interval_days * EASINESS_FACTOR;

    updated[concept] = {
      understanding_level,
      last_assessed: now,
      review_interval_days: interval,
      needed_instruction,
    };
  } else {
    updated[concept] = {
      understanding_level,
      last_assessed: now,
      review_interval_days: calculateNextReview(
        understanding_level,
        needed_instruction,
      ),
      needed_instruction,
    };
  }

  return updated;
}
