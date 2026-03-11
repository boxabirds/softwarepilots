import { useState, useEffect } from "react";
import { apiClient } from "../lib/api-client";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

const CALIBRATION_CLOSE = 1;
const CALIBRATION_MODERATE = 3;
const MAX_SCORE = 10;

interface SubmissionResult {
  score_json: string | null;
  self_assessment_json: string | null;
  calibration_gap_json: string | null;
}

interface DimensionScore {
  key: string;
  score: number;
  weight: number;
  feedback: string;
}

interface CalibrationGap {
  key: string;
  predicted: number;
  actual: number;
  gap: number;
}

interface ScoreDisplayProps {
  submissionId: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  code_comprehension: "Code Comprehension",
  prediction_accuracy: "Output Predictions",
  modification_quality: "Your Modification",
};

function calibrationLabel(absGap: number): string {
  if (absGap <= CALIBRATION_CLOSE) return "well calibrated";
  if (absGap <= CALIBRATION_MODERATE) return "moderate gap";
  return "large gap";
}

function gapColor(absGap: number): string {
  if (absGap <= CALIBRATION_CLOSE) return "var(--success)";
  if (absGap <= CALIBRATION_MODERATE) return "var(--warning)";
  return "var(--destructive)";
}

export function ScoreDisplay({ submissionId }: ScoreDisplayProps) {
  const [scores, setScores] = useState<DimensionScore[] | null>(null);
  const [gaps, setGaps] = useState<CalibrationGap[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let elapsed = 0;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled && elapsed < POLL_TIMEOUT_MS) {
        try {
          const result = await apiClient.get<SubmissionResult>(
            `/api/submissions/${submissionId}`
          );

          if (result.score_json) {
            setScores(JSON.parse(result.score_json));
            if (result.calibration_gap_json) {
              setGaps(JSON.parse(result.calibration_gap_json));
            }
            setLoading(false);
            return;
          }
        } catch {
          // Keep polling
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        elapsed += POLL_INTERVAL_MS;
      }

      if (!cancelled) {
        setError("Scoring is taking longer than expected. Your submission is saved — check back later.");
        setLoading(false);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [submissionId]);

  const overallScore = scores
    ? scores.reduce((sum, s) => sum + s.score * s.weight, 0) /
      scores.reduce((sum, s) => sum + s.weight, 0)
    : 0;

  return (
    <div style={{ padding: "20px" }}>

      {/* Evaluation */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0" }}>
          <Spinner />
          <span style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
            Evaluating your submission...
          </span>
        </div>
      ) : error ? (
        <div style={{ padding: "16px 0", color: "var(--destructive)", fontSize: 14 }}>
          {error}
        </div>
      ) : scores ? (
        <>
          <SectionLabel>Evaluation</SectionLabel>

          {/* Overall score */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)" }}>Overall</span>
            <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {overallScore.toFixed(1)}
              <span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted-foreground)" }}>/{MAX_SCORE}</span>
            </span>
          </div>
          <ProgressBar value={overallScore} max={MAX_SCORE} height={6} />

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            {scores.map((dim, i) => {
              const gap = gaps?.[i];
              const absGap = gap ? Math.abs(gap.gap) : 0;

              return (
                <div key={dim.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {DIMENSION_LABELS[dim.key] || dim.key}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {dim.score}
                      <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)" }}>/{MAX_SCORE}</span>
                    </span>
                  </div>

                  <ProgressBar value={dim.score} max={MAX_SCORE} height={4} />

                  {gap && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12 }}>
                      <span style={{ color: "var(--muted-foreground)" }}>
                        You predicted {gap.predicted}/{MAX_SCORE}
                      </span>
                      <span style={{ color: gapColor(absGap), fontWeight: 600 }}>
                        {gap.gap > 0 ? "+" : ""}{gap.gap} ({calibrationLabel(absGap)})
                      </span>
                    </div>
                  )}

                  <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--muted-foreground)" }}>
                    {dim.feedback}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---- Small layout helpers ---- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "var(--muted-foreground)",
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}


function ProgressBar({ value, max, height }: { value: number; max: number; height: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height, borderRadius: height, background: "var(--secondary)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: height, background: "var(--primary)", transition: "width 0.3s" }} />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 16,
      height: 16,
      border: "2px solid var(--primary)",
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    }} />
  );
}
