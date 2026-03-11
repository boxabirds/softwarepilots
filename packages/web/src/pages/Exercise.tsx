import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CodeEditor, type CodeEditorHandle } from "../components/CodeEditor";
import { SelfAssessment } from "../components/SelfAssessment";
import { ScoreDisplay } from "../components/ScoreDisplay";
import { apiClient } from "../lib/api-client";

/* ---- Exercise step definitions ---- */

interface ExerciseStep {
  prompt: string;
  input?: "prediction" | "reflection";
  showRun?: boolean;
}

const EXERCISE_STEPS: Record<string, ExerciseStep[]> = {
  "2.1": [
    {
      prompt: "Read the code below. **What do you think it will print?**",
      input: "prediction",
      showRun: true,
    },
    {
      prompt: "Now try removing `str()` from line 3 and run again. What happens?",
      showRun: true,
    },
    {
      prompt: "Make one more change of your own. Predict what will happen before you run it.",
      showRun: true,
    },
    {
      prompt: "**What did you change, and what did you learn?**",
      input: "reflection",
    },
  ],
};

const EXERCISE_TITLES: Record<string, string> = {
  "2.1": "The Compiler Moment",
};

const EDITOR_HEIGHT = 220;

/* ---- Component ---- */

type Phase = "steps" | "self-assessment" | "submitting" | "results";

export function Exercise() {
  const { moduleId, exerciseId } = useParams();
  const fullExerciseId = `${moduleId}.${exerciseId}` || "2.1";

  const editorRef = useRef<CodeEditorHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps = EXERCISE_STEPS[fullExerciseId] || [];
  const title = EXERCISE_TITLES[fullExerciseId] || "Exercise";

  const [phase, setPhase] = useState<Phase>("steps");
  const [code, setCode] = useState("");
  const [prediction, setPrediction] = useState("");
  const [reflection, setReflection] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Each run produces an output; outputs[i] is the result shown after step i
  const [outputs, setOutputs] = useState<string[]>([]);
  const runCount = outputs.length;

  // The current active step index
  const activeStep = Math.min(runCount, steps.length - 1);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  useEffect(() => { scrollToBottom(); }, [runCount, phase]);

  const handleRun = (output: string) => {
    setOutputs((prev) => [...prev, output]);
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
          console_output: outputs[outputs.length - 1] || "",
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
      setPhase("steps");
    }
  };

  const runDisabled = !editorReady || phase !== "steps";

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
          <span style={labelStyle}>
            Module {moduleId} &middot; Exercise {exerciseId}
          </span>
          <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>{title}</h1>
        </div>

        {/* Code editor — always visible */}
        <Card>
          <div style={{ borderRadius: 8, overflow: "hidden", height: EDITOR_HEIGHT }}>
            <CodeEditor
              ref={editorRef}
              exerciseId={fullExerciseId}
              onCodeChange={setCode}
              onRun={handleRun}
              disabled={phase !== "steps"}
              onReadyChange={setEditorReady}
            />
          </div>
        </Card>

        {/* Render completed steps and their outputs */}
        {steps.map((step, i) => {
          const isCompleted = i < activeStep;
          const isActive = i === activeStep && phase === "steps";
          const visible = i <= activeStep && phase !== "submitting";

          if (!visible) return null;

          return (
            <div key={i}>
              {/* Step prompt card */}
              <Card>
                <StepPrompt text={step.prompt} />

                {/* Input field for this step */}
                {step.input === "prediction" && (
                  <textarea
                    value={prediction}
                    onChange={(e) => setPrediction(e.target.value)}
                    placeholder="Type your prediction..."
                    rows={2}
                    disabled={isCompleted}
                    style={{
                      ...textareaStyle,
                      marginTop: 12,
                      ...(isCompleted ? disabledTextareaStyle : {}),
                    }}
                  />
                )}

                {step.input === "reflection" && isActive && (
                  <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="e.g. I removed str() and got a TypeError — Python can't concatenate a string with a float."
                    rows={3}
                    style={{ ...textareaStyle, marginTop: 12 }}
                  />
                )}

                {/* Action buttons */}
                {isActive && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                    {step.showRun && (
                      <button
                        onClick={handleRunClick}
                        disabled={runDisabled}
                        style={runDisabled ? btnDisabledInline : btnPrimaryInline}
                      >
                        {editorReady && <span style={{ fontSize: 11 }}>&#9654;</span>}
                        {" "}{!editorReady ? "Loading Python..." : "Run"}
                      </button>
                    )}

                    {step.input === "reflection" && (
                      <button
                        onClick={handleSubmitClick}
                        disabled={!reflection.trim()}
                        style={reflection.trim() ? btnPrimaryInline : btnDisabledInline}
                      >
                        Submit for Evaluation
                      </button>
                    )}
                  </div>
                )}
              </Card>

              {/* Output card after this step's run */}
              {outputs[i] !== undefined && (
                <Card>
                  {i === 0 && prediction.trim() && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={fieldLabelStyle}>Your prediction</label>
                      <div style={quotedBlockStyle}>{prediction}</div>
                    </div>
                  )}
                  <label style={fieldLabelStyle}>Output</label>
                  <pre style={consoleStyle}>{outputs[i]}</pre>
                </Card>
              )}
            </div>
          );
        })}

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
              <div style={spinnerStyle} />
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

/* ---- Step prompt with inline markdown ---- */

function StepPrompt({ text }: { text: string }) {
  // Simple inline markdown: **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} style={inlineCodeStyle}>{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
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

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--muted-foreground)",
};

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

const disabledTextareaStyle: React.CSSProperties = {
  background: "var(--muted)",
  color: "var(--muted-foreground)",
  cursor: "default",
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

const inlineCodeStyle: React.CSSProperties = {
  padding: "2px 5px",
  fontSize: 12,
  fontFamily: "monospace",
  background: "var(--muted)",
  borderRadius: 4,
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

const spinnerStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  border: "2px solid var(--primary)",
  borderTopColor: "transparent",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};
