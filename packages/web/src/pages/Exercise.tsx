import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CodeEditor, type CodeEditorHandle } from "../components/CodeEditor";
import { Narrative } from "../components/Narrative";
import { SelfAssessment } from "../components/SelfAssessment";
import { ScoreDisplay } from "../components/ScoreDisplay";
import { apiClient } from "../lib/api-client";

type ExercisePhase = "coding" | "self-assessment" | "submitting" | "results";

const EXERCISE_NARRATIVE: Record<string, string> = {
  "2.1": `The code below does five things: assigns a number, computes a tax, builds a label, checks a condition, and prints.

**Your task:**

1. Read the code. Write your prediction of what it will print.
2. Click **Run** to see if you were right.
3. Try removing \`str()\` from line 3 and run again. What happens?
4. Make one more change of your own. Predict the output before running.
5. Describe what you changed and what you learned, then click **Submit**.`,
};

const MIN_RUNS_BEFORE_SUBMIT = 1;
const EDITOR_HEIGHT = 220;

export function Exercise() {
  const { moduleId, exerciseId } = useParams();
  const fullExerciseId = `${moduleId}.${exerciseId}` || "2.1";

  const editorRef = useRef<CodeEditorHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<ExercisePhase>("coding");
  const [code, setCode] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [prediction, setPrediction] = useState("");
  const [reflection, setReflection] = useState("");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [editorReady, setEditorReady] = useState(false);

  const narrative = EXERCISE_NARRATIVE[fullExerciseId] || "Exercise not found.";
  const hasRun = runCount >= MIN_RUNS_BEFORE_SUBMIT;

  // Auto-scroll to bottom when new content appears
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  useEffect(() => { scrollToBottom(); }, [phase, runCount, consoleOutput]);

  const handleRun = (output: string) => {
    setConsoleOutput(output);
    setRunCount((prev) => prev + 1);
  };

  const handleRunClick = () => {
    editorRef.current?.run();
  };

  const handleSubmitClick = () => {
    setPhase("self-assessment");
  };

  const handleSelfAssessmentSubmit = async (
    predictions: Record<string, number>,
    weakestDimension: string
  ) => {
    setPhase("submitting");

    const modifications = [];
    if (reflection.trim()) {
      modifications.push(reflection.trim());
    }

    try {
      const result = await apiClient.post<{ id: string }>("/api/submissions", {
        module_id: moduleId,
        exercise_id: fullExerciseId,
        content: {
          code,
          console_output: consoleOutput,
          prediction: prediction.trim(),
          modifications,
        },
        self_assessment: {
          predictions,
          weakest_dimension: weakestDimension,
        },
      });

      setSubmissionId(result.id);
      setPhase("results");
    } catch {
      setPhase("coding");
    }
  };

  const canSubmit = hasRun && reflection.trim().length > 0;
  const runDisabled = !editorReady || phase !== "coding";
  const runLabel = !editorReady ? "Loading Python..." : "Run";

  return (
    <div
      ref={scrollRef}
      style={{
        height: "100dvh",
        overflowY: "auto",
        background: "var(--muted)",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
            Module {moduleId} &middot; Exercise {exerciseId}
          </span>
          <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>The Compiler Moment</h1>
        </div>

        {/* Instructions */}
        <Card>
          <Narrative text={narrative} />
        </Card>

        {/* Code editor */}
        <Card>
          <div style={{ borderRadius: 8, overflow: "hidden", height: EDITOR_HEIGHT }}>
            <CodeEditor
              ref={editorRef}
              exerciseId={fullExerciseId}
              onCodeChange={setCode}
              onRun={handleRun}
              disabled={phase !== "coding"}
              onReadyChange={setEditorReady}
            />
          </div>
        </Card>

        {/* Prediction — editable before first run */}
        {!hasRun && phase === "coding" && (
          <Card>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              What will this code print?
            </label>
            <textarea
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder="Type your prediction..."
              rows={2}
              style={textareaStyle}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={handleRunClick} disabled={runDisabled} style={runDisabled ? btnDisabledInline : btnPrimaryInline}>
                {editorReady && <span style={{ fontSize: 11 }}>&#9654;</span>}
                {" "}{runLabel}
              </button>
            </div>
          </Card>
        )}

        {/* After run: prediction vs actual output */}
        {hasRun && (
          <Card>
            {prediction.trim() && (
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabelStyle}>Your prediction</label>
                <div style={quotedBlockStyle}>{prediction}</div>
              </div>
            )}
            <label style={fieldLabelStyle}>Actual output</label>
            <pre style={consoleStyle}>{consoleOutput}</pre>
          </Card>
        )}

        {/* Run again button (after first run, still coding) */}
        {hasRun && phase === "coding" && (
          <Card>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              What did you change, and what did you learn?
            </label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="e.g. I removed str() and got a TypeError — Python can't concatenate a string with a float."
              rows={3}
              style={textareaStyle}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={handleRunClick} disabled={runDisabled} style={{ ...btnInlineBase, background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid var(--border)" }}>
                {editorReady && <span style={{ fontSize: 11 }}>&#9654;</span>}
                {" "}Run again
              </button>
              <button
                onClick={handleSubmitClick}
                disabled={!canSubmit}
                style={canSubmit ? btnPrimaryInline : btnDisabledInline}
              >
                Submit for Evaluation
              </button>
            </div>
          </Card>
        )}

        {/* Self-assessment */}
        {phase === "self-assessment" && (
          <Card>
            <SelfAssessment onSubmit={handleSelfAssessmentSubmit} />
          </Card>
        )}

        {/* Submitting spinner */}
        {phase === "submitting" && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 0" }}>
              <div style={{ width: 16, height: 16, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Evaluating...</span>
            </div>
          </Card>
        )}

        {/* Results */}
        {phase === "results" && submissionId && (
          <Card noPad>
            <ScoreDisplay submissionId={submissionId} />
          </Card>
        )}
      </div>
    </div>
  );
}

/* ---- Reusable card wrapper ---- */

function Card({ children, noPad }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{
      marginTop: 16,
      padding: noPad ? 0 : 20,
      background: "var(--background)",
      borderRadius: 10,
      border: "1px solid var(--border)",
    }}>
      {children}
    </div>
  );
}

/* ---- Styles ---- */

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--muted-foreground)",
};

const textareaStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "monospace",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--background)",
  color: "var(--foreground)",
  resize: "none",
  outline: "none",
};

const consoleStyle: React.CSSProperties = {
  margin: 0,
  padding: "12px 16px",
  fontSize: 13,
  fontFamily: "monospace",
  lineHeight: 1.5,
  background: "#0d1117",
  color: "#c9d1d9",
  borderRadius: 6,
  whiteSpace: "pre-wrap",
  overflowX: "auto",
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  marginTop: 12,
  padding: "8px 20px",
  fontSize: 13,
  fontWeight: 500,
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  width: "100%",
};

const btnPrimaryStyle: React.CSSProperties = {
  ...btnBase,
  background: "var(--primary)",
  color: "var(--primary-foreground)",
};

const btnSecondaryStyle: React.CSSProperties = {
  ...btnBase,
  background: "var(--secondary)",
  color: "var(--secondary-foreground)",
  border: "1px solid var(--border)",
};

const btnDisabledStyle: React.CSSProperties = {
  ...btnBase,
  background: "var(--muted)",
  color: "var(--muted-foreground)",
  cursor: "default",
};

const quotedBlockStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "monospace",
  lineHeight: 1.5,
  borderLeft: "3px solid var(--border)",
  background: "var(--muted)",
  borderRadius: "0 4px 4px 0",
  color: "var(--foreground)",
};

const btnInlineBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "7px 16px",
  fontSize: 13,
  fontWeight: 500,
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const btnPrimaryInline: React.CSSProperties = {
  ...btnInlineBase,
  background: "var(--primary)",
  color: "var(--primary-foreground)",
};

const btnDisabledInline: React.CSSProperties = {
  ...btnInlineBase,
  background: "var(--muted)",
  color: "var(--muted-foreground)",
  cursor: "default",
};
