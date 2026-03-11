import { useState, useRef, useEffect, useCallback } from "react";
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

interface RunSnapshot {
  code: string;
  output: string;
}

const EXERCISE_STEPS: Record<string, ExerciseStep[]> = {
  "2.1": [
    {
      prompt: "Read the code. **What do you think it will print?**",
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

const EDITOR_MIN_HEIGHT = 300;

type Phase = "steps" | "self-assessment" | "submitting" | "results";

/* ---- Component ---- */

export function Exercise() {
  const { moduleId, exerciseId } = useParams();
  const fullExerciseId = `${moduleId}.${exerciseId}` || "2.1";

  const steps = EXERCISE_STEPS[fullExerciseId] || [];
  const title = EXERCISE_TITLES[fullExerciseId] || "Exercise";

  const editorRef = useRef<CodeEditorHandle>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("steps");
  const [code, setCode] = useState("");
  const [prediction, setPrediction] = useState("");
  const [reflection, setReflection] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<RunSnapshot[]>([]);
  const [viewingSnapshot, setViewingSnapshot] = useState<number | null>(null);
  const [readyMessage, setReadyMessage] = useState(false);

  const activeStep = Math.min(snapshots.length, steps.length - 1);
  const currentStep = steps[activeStep];
  const runDisabled = !editorReady || phase !== "steps" || viewingSnapshot !== null;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [snapshots.length, phase, scrollToBottom]);

  const handleRun = (output: string) => {
    setSnapshots((prev) => [...prev, { code, output }]);
  };

  const handleRunClick = () => {
    editorRef.current?.run();
  };

  const handleSnapshotClick = (index: number) => {
    setViewingSnapshot(index);
  };

  const handleResumeEditing = () => {
    setViewingSnapshot(null);
    setReadyMessage(true);
    scrollToBottom();
  };

  const handleSubmitClick = () => {
    setPhase("self-assessment");
  };

  const submitToApi = async (
    selfAssessment?: { predictions: Record<string, number>; weakest_dimension: string }
  ) => {
    setPhase("submitting");

    const modifications: string[] = [];
    if (reflection.trim()) modifications.push(reflection.trim());

    try {
      const payload: Record<string, unknown> = {
        module_id: moduleId,
        exercise_id: fullExerciseId,
        content: {
          code,
          console_output: snapshots[snapshots.length - 1]?.output || "",
          prediction: prediction.trim(),
          modifications,
        },
      };
      if (selfAssessment) {
        payload.self_assessment = selfAssessment;
      }

      const result = await apiClient.post<{ id: string }>("/api/submissions", payload);
      setSubmissionId(result.id);
      setPhase("results");
    } catch {
      setPhase("steps");
    }
  };

  const handleSelfAssessmentSubmit = (
    predictions: Record<string, number>,
    weakestDimension: string
  ) => {
    submitToApi({ predictions, weakest_dimension: weakestDimension });
  };

  const handleSkipSelfAssessment = () => {
    submitToApi();
  };

  /* ---- Chat content (derived from state) ---- */

  function renderChat() {
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < steps.length; i++) {
      if (i > activeStep) break;

      const step = steps[i];

      // Step prompt
      elements.push(
        <ChatCard key={`prompt-${i}`}>
          <StepPrompt text={step.prompt} />
        </ChatCard>
      );

      // Frozen prediction (shown after first run, stays in history)
      if (i === 0 && prediction.trim() && snapshots.length > 0) {
        elements.push(
          <ChatCard key="prediction" muted>
            <FieldLabel>Your prediction</FieldLabel>
            <QuotedBlock>{prediction}</QuotedBlock>
          </ChatCard>
        );
      }

      // Output cell (clickable to view code snapshot)
      if (snapshots[i]) {
        const isSelected = viewingSnapshot === i;
        elements.push(
          <OutputCard
            key={`output-${i}`}
            index={i}
            output={snapshots[i].output}
            selected={isSelected}
            onClick={() => handleSnapshotClick(i)}
          />
        );
      }
    }

    // "Ready to test" message after resuming editing
    if (readyMessage && phase === "steps") {
      elements.push(
        <ChatCard key="ready" muted>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Ready to test your new edits.
          </span>
        </ChatCard>
      );
    }

    // Submitting spinner
    if (phase === "submitting") {
      elements.push(
        <ChatCard key="submitting">
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
            <div style={spinnerStyle} />
            <span style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Evaluating...</span>
          </div>
        </ChatCard>
      );
    }

    // Results
    if (phase === "results" && submissionId) {
      elements.push(
        <div key="results" style={{
          marginTop: 12,
          background: "var(--background)",
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}>
          <ScoreDisplay submissionId={submissionId} />
        </div>
      );
    }

    return elements;
  }

  /* ---- Input bar content (fixed at bottom of RHS) ---- */

  function renderInputBar() {
    if (phase === "submitting") {
      return <InputHint>Waiting for evaluation...</InputHint>;
    }
    if (phase === "results") {
      return <InputHint>Exercise complete.</InputHint>;
    }
    if (phase === "self-assessment") {
      return <InputHint>Complete self-assessment above...</InputHint>;
    }

    if (!currentStep) return null;

    if (currentStep.input === "prediction") {
      return (
        <textarea
          value={prediction}
          onChange={(e) => setPrediction(e.target.value)}
          placeholder="Type your prediction..."
          rows={2}
          style={textareaStyle}
          autoFocus
        />
      );
    }

    if (currentStep.input === "reflection") {
      return (
        <div>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="e.g. I removed str() and got a TypeError..."
            rows={3}
            style={textareaStyle}
            autoFocus
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button
              onClick={handleSubmitClick}
              disabled={!reflection.trim()}
              style={reflection.trim() ? btnPrimary : btnDisabled}
            >
              Submit for Evaluation
            </button>
          </div>
        </div>
      );
    }

    if (currentStep.showRun) {
      return (
        <InputHint>
          Make your change in the editor, then click <strong>Run</strong>.
        </InputHint>
      );
    }

    return null;
  }

  /* ---- Layout ---- */

  return (
    <div style={{ display: "flex", height: "100dvh", background: "var(--muted)" }}>

      {/* ===== LHS: Editor panel ===== */}
      <div style={{
        width: "50%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border)",
        background: "var(--background)",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={metaLabelStyle}>
            Module {moduleId} &middot; Exercise {exerciseId}
          </span>
          <h1 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700 }}>{title}</h1>
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, position: "relative", minHeight: EDITOR_MIN_HEIGHT }}>
          {/* CodeEditor always mounted for state preservation */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: viewingSnapshot !== null ? "none" : "block",
          }}>
            <CodeEditor
              ref={editorRef}
              exerciseId={fullExerciseId}
              onCodeChange={setCode}
              onRun={handleRun}
              disabled={phase !== "steps"}
              onReadyChange={setEditorReady}
            />
          </div>

          {/* Snapshot viewer (read-only) */}
          {viewingSnapshot !== null && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
              <div style={{
                padding: "8px 16px",
                background: "var(--muted)",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--muted-foreground)",
                borderBottom: "1px solid var(--border)",
              }}>
                Viewing code from run #{viewingSnapshot + 1} (read-only)
              </div>
              <pre style={snapshotCodeStyle}>
                {snapshots[viewingSnapshot].code}
              </pre>
            </div>
          )}
        </div>

        {/* Bottom bar: Run or Resume editing */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
        }}>
          {viewingSnapshot !== null ? (
            <button onClick={handleResumeEditing} style={btnPrimary}>
              Make another edit
            </button>
          ) : (
            <button
              onClick={handleRunClick}
              disabled={runDisabled}
              style={runDisabled ? btnDisabled : btnPrimary}
            >
              {editorReady && <span style={{ fontSize: 11 }}>&#9654;</span>}
              {" "}{!editorReady ? "Loading Python..." : "Run"}
            </button>
          )}
        </div>
      </div>

      {/* ===== RHS: Chat + input ===== */}
      <div style={{
        width: "50%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}>
        {/* Scrollable chat area */}
        <div
          ref={chatRef}
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px 16px" }}
        >
          {renderChat()}
        </div>

        {/* Self-assessment popup (above input bar) */}
        {phase === "self-assessment" && (
          <div style={{
            borderTop: "1px solid var(--border)",
            padding: "20px",
            background: "var(--background)",
            boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
            maxHeight: "60vh",
            overflowY: "auto",
          }}>
            <SelfAssessment
              onSubmit={handleSelfAssessmentSubmit}
              onSkip={handleSkipSelfAssessment}
            />
          </div>
        )}

        {/* Fixed input bar */}
        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 20px",
          background: "var(--background)",
        }}>
          {renderInputBar()}
        </div>
      </div>
    </div>
  );
}

/* ---- Small components ---- */

function ChatCard({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{
      marginTop: 12,
      padding: 16,
      background: muted ? "var(--muted)" : "var(--background)",
      borderRadius: 10,
      border: "1px solid var(--border)",
    }}>
      {children}
    </div>
  );
}

function OutputCard({ index, output, selected, onClick }: {
  index: number;
  output: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        marginTop: 12,
        padding: 16,
        background: "var(--background)",
        borderRadius: 10,
        border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <FieldLabel>Output (run #{index + 1})</FieldLabel>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {selected ? "viewing code ←" : "click to view code"}
        </span>
      </div>
      <pre style={consoleStyle}>{output}</pre>
    </div>
  );
}

function StepPrompt({ text }: { text: string }) {
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 4 }}>
      {children}
    </div>
  );
}

function QuotedBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "8px 12px",
      fontSize: 13,
      fontFamily: "monospace",
      lineHeight: 1.5,
      borderLeft: "3px solid var(--border)",
      background: "var(--muted)",
      borderRadius: "0 4px 4px 0",
      color: "var(--foreground)",
    }}>
      {children}
    </div>
  );
}

function InputHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

/* ---- Styles ---- */

const metaLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
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

const snapshotCodeStyle: React.CSSProperties = {
  flex: 1,
  margin: 0,
  padding: "16px 20px",
  fontSize: 13,
  fontFamily: "monospace",
  lineHeight: 1.6,
  background: "#1e1e1e",
  color: "#d4d4d4",
  overflowY: "auto",
  whiteSpace: "pre-wrap",
};

const inlineCodeStyle: React.CSSProperties = {
  padding: "2px 5px",
  fontSize: 12,
  fontFamily: "monospace",
  background: "var(--muted)",
  borderRadius: 4,
};

const btnBase: React.CSSProperties = {
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

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--primary)",
  color: "var(--primary-foreground)",
};

const btnDisabled: React.CSSProperties = {
  ...btnBase,
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
