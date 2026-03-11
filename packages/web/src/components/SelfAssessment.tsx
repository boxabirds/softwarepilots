import { useState } from "react";

const MIN_SCORE = 1;
const MAX_SCORE = 10;
const DEFAULT_SCORE = 5;

interface DimensionDisplay {
  key: string;
  label: string;
  self_assessment_description: string;
}

interface SelfAssessmentProps {
  dimensions: DimensionDisplay[];
  onSubmit: (predictions: Record<string, number>, weakestDimension: string) => void;
  onSkip?: () => void;
}

export function SelfAssessment({ dimensions, onSubmit, onSkip }: SelfAssessmentProps) {
  const [predictions, setPredictions] = useState<Record<string, number>>(
    () => Object.fromEntries(dimensions.map((d) => [d.key, DEFAULT_SCORE]))
  );
  const [weakest, setWeakest] = useState("");

  const isComplete = weakest !== "" && Object.keys(predictions).length === dimensions.length;

  const handleSubmit = () => {
    if (!isComplete) return;
    onSubmit(predictions, weakest);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Before you see your scores...</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
          Rate how you think you did on each dimension.
        </div>
      </div>

      {dimensions.map((dim) => (
        <div key={dim.key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{dim.label}</label>
            <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {predictions[dim.key]}/{MAX_SCORE}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>{dim.self_assessment_description}</div>
          <input
            type="range"
            min={MIN_SCORE}
            max={MAX_SCORE}
            step={1}
            value={predictions[dim.key]}
            onChange={(e) =>
              setPredictions((prev) => ({ ...prev, [dim.key]: Number(e.target.value) }))
            }
            style={{ width: "100%", accentColor: "var(--primary)" }}
          />
        </div>
      ))}

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
          Which dimension are you least confident about?
        </label>
        <select
          value={weakest}
          onChange={(e) => setWeakest(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 10px",
            fontSize: 13,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--background)",
            color: "var(--foreground)",
          }}
        >
          <option value="">Select...</option>
          <option value="none">None — I'm confident in all three</option>
          {dimensions.map((dim) => (
            <option key={dim.key} value={dim.key}>{dim.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {onSkip && (
          <button
            onClick={onSkip}
            style={{
              flex: 1,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              background: "var(--secondary)",
              color: "var(--secondary-foreground)",
            }}
          >
            Skip
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isComplete}
          style={{
            flex: 2,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 500,
            border: "none",
            borderRadius: 6,
            cursor: isComplete ? "pointer" : "default",
            background: isComplete ? "var(--primary)" : "var(--muted)",
            color: isComplete ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          Submit with Self-Assessment
        </button>
      </div>
    </div>
  );
}
