export interface DimensionScore {
  key: string;
  score: number;
  weight: number;
  feedback: string;
}

export interface CalibrationGap {
  key: string;
  predicted: number;
  actual: number;
  gap: number; // actual - predicted (positive = underestimated, negative = overestimated)
}

export interface ScoringResult {
  dimension_scores: DimensionScore[];
  overall_score: number;
  passed: boolean;
  calibration_gaps: CalibrationGap[];
}

export function computeOverallScore(
  dimensions: DimensionScore[]
): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = dimensions.reduce(
    (sum, d) => sum + d.score * d.weight,
    0
  );
  return weightedSum / totalWeight;
}

export function computeCalibrationGaps(
  dimensions: DimensionScore[],
  predictions: Record<string, number>
): CalibrationGap[] {
  return dimensions.map((d) => {
    const predicted = predictions[d.key] ?? 0;
    return {
      key: d.key,
      predicted,
      actual: d.score,
      gap: d.score - predicted,
    };
  });
}

export function buildScoringResult(
  dimensions: DimensionScore[],
  predictions: Record<string, number>,
  passThreshold: number
): ScoringResult {
  const overall = computeOverallScore(dimensions);
  const MAX_SCORE = 10;
  const normalised = overall / MAX_SCORE;

  return {
    dimension_scores: dimensions,
    overall_score: overall,
    passed: normalised >= passThreshold,
    calibration_gaps: computeCalibrationGaps(dimensions, predictions),
  };
}
