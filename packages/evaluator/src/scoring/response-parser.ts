import type { DimensionScore } from "./gap-calculator";

interface RubricDimension {
  key: string;
  weight: number;
}

interface ParsedScore {
  key: string;
  score: number;
  feedback: string;
}

const MIN_SCORE = 1;
const MAX_SCORE = 10;

export function parseEvaluatorResponse(
  raw: string,
  rubricDimensions: RubricDimension[]
): DimensionScore[] {
  const parsed = tryParseJSON(raw) ?? tryExtractJSON(raw);

  if (!parsed?.scores || !Array.isArray(parsed.scores)) {
    throw new Error("Evaluator response missing 'scores' array");
  }

  const scoreMap = new Map<string, ParsedScore>();
  for (const s of parsed.scores as ParsedScore[]) {
    if (s.key && typeof s.score === "number" && typeof s.feedback === "string") {
      scoreMap.set(s.key, s);
    }
  }

  return rubricDimensions.map((dim) => {
    const match = scoreMap.get(dim.key);
    const score = match
      ? Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(match.score)))
      : MIN_SCORE;
    const feedback = match?.feedback || "No feedback provided for this dimension.";

    return {
      key: dim.key,
      score,
      weight: dim.weight,
      feedback,
    };
  });
}

function tryParseJSON(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function tryExtractJSON(raw: string): Record<string, unknown> | null {
  // Regex fallback: find first { ... } block
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return tryParseJSON(match[0]);
}
