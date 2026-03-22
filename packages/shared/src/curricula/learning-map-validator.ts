import type { SectionLearningMap } from "../curricula";

const MIN_CLAIMS = 3;
const MAX_CLAIMS = 7;
const MIN_SUB_INSIGHTS = 2;
const MAX_SUB_INSIGHTS = 4;

const VAGUE_CRITERIA_PATTERNS = [
  "understands",
  "knows",
  "is aware of",
  "familiar with",
  "has knowledge of",
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLearningMap(
  map: SectionLearningMap,
  sectionConcepts: string[],
): ValidationResult {
  const errors: string[] = [];

  // Rule: 3-7 core claims
  const claimCount = map.core_claims.length;
  if (claimCount < MIN_CLAIMS || claimCount > MAX_CLAIMS) {
    errors.push(
      `Expected ${MIN_CLAIMS}-${MAX_CLAIMS} core_claims, got ${claimCount}`
    );
  }

  // Rule: every claim must have at least one concept (only when section has concepts)
  const hasSectionConcepts = sectionConcepts.length > 0;
  if (hasSectionConcepts) {
    for (const claim of map.core_claims) {
      if (claim.concepts.length === 0) {
        errors.push(`Claim "${claim.id}" has no concepts`);
      }
    }
  }

  // Rule: all claim IDs must be unique
  const claimIds = map.core_claims.map((c) => c.id);
  const uniqueClaimIds = new Set(claimIds);
  if (uniqueClaimIds.size !== claimIds.length) {
    const seen = new Set<string>();
    for (const id of claimIds) {
      if (seen.has(id)) {
        errors.push(`Duplicate claim ID: "${id}"`);
      }
      seen.add(id);
    }
  }

  // Rule: every section concept must appear in at least one claim's concepts
  // Uses word-overlap matching to handle LLM abbreviation of verbose concept names
  if (hasSectionConcepts) {
    const allClaimConceptsLower = map.core_claims
      .flatMap((c) => c.concepts)
      .map((c) => c.toLowerCase());

    for (const concept of sectionConcepts) {
      const conceptLower = concept.toLowerCase();

      // Exact match
      if (allClaimConceptsLower.includes(conceptLower)) continue;

      // Prefix before " - " delimiter
      const prefix = concept.split(" - ")[0].trim().toLowerCase();
      if (prefix !== conceptLower && allClaimConceptsLower.includes(prefix)) continue;

      // Substring containment (either direction)
      const substringMatch = allClaimConceptsLower.some(
        (cc) => cc.includes(conceptLower) || conceptLower.includes(cc)
      );
      if (substringMatch) continue;

      // Word-overlap: extract significant words (3+ chars) and check if any claim
      // concept shares at least half of them
      const significantWords = extractSignificantWords(conceptLower);
      if (significantWords.length > 0) {
        const wordMatch = allClaimConceptsLower.some((cc) => {
          const ccWords = extractSignificantWords(cc);
          const overlap = significantWords.filter((w) => ccWords.includes(w));
          return overlap.length >= Math.ceil(significantWords.length / 2);
        });
        if (wordMatch) continue;
      }

      errors.push(
        `Section concept "${concept}" not covered by any claim`
      );
    }
  }

  // Rule: no vague demonstration criteria
  for (const claim of map.core_claims) {
    const criteriaLower = claim.demonstration_criteria.toLowerCase();
    for (const pattern of VAGUE_CRITERIA_PATTERNS) {
      if (criteriaLower.includes(pattern)) {
        errors.push(
          `Claim "${claim.id}" has vague demonstration_criteria containing "${pattern}"`
        );
      }
    }
  }

  // Rule: 2-4 sub-insights in key_intuition_decomposition
  const subInsightCount = map.key_intuition_decomposition.length;
  if (subInsightCount < MIN_SUB_INSIGHTS || subInsightCount > MAX_SUB_INSIGHTS) {
    errors.push(
      `Expected ${MIN_SUB_INSIGHTS}-${MAX_SUB_INSIGHTS} key_intuition_decomposition entries, got ${subInsightCount}`
    );
  }

  // Rule: all misconception related_claims reference valid claim IDs
  for (const misconception of map.key_misconceptions) {
    for (const relatedClaimId of misconception.related_claims) {
      if (!uniqueClaimIds.has(relatedClaimId)) {
        errors.push(
          `Misconception "${misconception.id}" references unknown claim "${relatedClaimId}"`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

const MIN_SIGNIFICANT_WORD_LENGTH = 3;
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "are", "was", "not",
  "but", "have", "has", "its", "new", "you", "your", "can",
]);

function extractSignificantWords(text: string): string[] {
  return text
    .split(/[\s\-\/(),"']+/)
    .filter((w) => w.length >= MIN_SIGNIFICANT_WORD_LENGTH && !STOP_WORDS.has(w));
}
