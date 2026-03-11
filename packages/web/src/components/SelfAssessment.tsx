import { useState } from "react";

const DIMENSIONS = [
  { key: "code_comprehension", label: "Code Comprehension", description: "How well could you explain what each line does to someone else?" },
  { key: "prediction_accuracy", label: "Output Predictions", description: "When you predicted what the code would print, how often were you right?" },
  { key: "modification_quality", label: "Your Modification", description: "How deliberate was your change — did you know what would happen before you ran it?" },
];

const MIN_SCORE = 1;
const MAX_SCORE = 10;
const DEFAULT_SCORE = 5;

interface SelfAssessmentProps {
  onSubmit: (predictions: Record<string, number>, weakestDimension: string) => void;
}

export function SelfAssessment({ onSubmit }: SelfAssessmentProps) {
  const [predictions, setPredictions] = useState<Record<string, number>>(
    () => Object.fromEntries(DIMENSIONS.map((d) => [d.key, DEFAULT_SCORE]))
  );
  const [weakest, setWeakest] = useState("");

  const isComplete = weakest !== "" && Object.keys(predictions).length === DIMENSIONS.length;

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

      {DIMENSIONS.map((dim) => (
        <div key={dim.key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{dim.label}</label>
            <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {predictions[dim.key]}/{MAX_SCORE}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>{dim.description}</div>
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
          {DIMENSIONS.map((dim) => (
            <option key={dim.key} value={dim.key}>{dim.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!isComplete}
        style={{
          width: "100%",
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
  );
}
