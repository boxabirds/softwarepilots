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
const SCROLL_BOTTOM_THRESHOLD = 50;
const SUBMIT_BUTTON_SIZE = 32;

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
  const [predictionSubmitted, setPredictionSubmitted] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const activeStep = Math.min(snapshots.length, steps.length - 1);
  const currentStep = steps[activeStep];

  // Run is disabled if: not ready, not in steps phase, viewing snapshot,
  // or step requires prediction input that hasn't been submitted yet
  const needsPrediction = activeStep === 0 && currentStep?.input === "prediction" && !predictionSubmitted;
  const runDisabled = !editorReady || phase !== "steps" || viewingSnapshot !== null || needsPrediction;

  /* ---- Scrolling ---- */

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD);
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleChatScroll);
    return () => el.removeEventListener("scroll", handleChatScroll);
  }, [handleChatScroll]);

  useEffect(() => { scrollToBottom(); }, [snapshots.length, phase, predictionSubmitted, scrollToBottom]);

  /* ---- Handlers ---- */

  const handleRun = (output: string) => {
    setSnapshots((prev) => [...prev, { code, output }]);
    setReadyMessage(false);
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

  const handlePredictionSubmit = () => {
    if (!prediction.trim()) return;
    setPredictionSubmitted(true);
  };

  const handleReflectionSubmit = () => {
    if (!reflection.trim()) return;
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

  /* ---- Chat content ---- */

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

      // Step 0: prediction + output comparison card
      if (i === 0 && prediction.trim() && predictionSubmitted) {
        if (snapshots[0]) {
          // After run: show prediction vs output side-by-side
          const isSelected = viewingSnapshot === 0;
          elements.push(
            <ComparisonCard
              key="comparison"
              prediction={prediction}
              output={snapshots[0].output}
              selected={isSelected}
              onClick={() => handleSnapshotClick(0)}
            />
          );
        } else {
          // Prediction submitted but not yet run
          elements.push(
            <ChatCard key="prediction" align="right">
              <div style={quotedBlockStyle}>{prediction}</div>
            </ChatCard>
          );
          elements.push(
            <ChatCard key="run-hint" muted>
              <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                Click <strong>Run</strong> to see if you were right.
              </span>
            </ChatCard>
          );
        }
        continue; // skip the generic output card for step 0
      }

      // Output cell (clickable to view code snapshot) — steps 1+
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

    // Reflection shown in chat after submission
    if (reflection.trim() && phase !== "steps") {
      elements.push(
        <ChatCard key="reflection" align="right">
          <div style={quotedBlockStyle}>{reflection}</div>
        </ChatCard>
      );
    }

    // "Ready to test" message
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

  /* ---- Input bar ---- */

  function renderInputBar() {
    // Non-interactive states: just show status text inside the pill
    if (phase === "submitting") {
      return (
        <InputPill>
          <span style={hintTextStyle}>Waiting for evaluation...</span>
        </InputPill>
      );
    }
    if (phase === "results") {
      return (
        <InputPill>
          <span style={hintTextStyle}>Exercise complete.</span>
        </InputPill>
      );
    }
    if (phase === "self-assessment") {
      return (
        <InputPill>
          <span style={hintTextStyle}>Complete self-assessment above...</span>
        </InputPill>
      );
    }

    if (!currentStep) return null;

    // Step 0: prediction input (before submitted)
    if (currentStep.input === "prediction" && !predictionSubmitted) {
      return (
        <InputPill>
          <textarea
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
            placeholder="Type your prediction..."
            rows={2}
            style={pillTextareaStyle}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && prediction.trim()) {
                e.preventDefault();
                handlePredictionSubmit();
              }
            }}
          />
          <SubmitArrow active={!!prediction.trim()} onClick={handlePredictionSubmit} />
        </InputPill>
      );
    }

    // Step 0 after prediction submitted: hint to run
    if (currentStep.input === "prediction" && predictionSubmitted) {
      return (
        <InputPill>
          <span style={hintTextStyle}>
            Click <strong>Run</strong> to test your prediction.
          </span>
        </InputPill>
      );
    }

    // Reflection input
    if (currentStep.input === "reflection") {
      return (
        <InputPill>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What did you change and what did you learn?"
            rows={2}
            style={pillTextareaStyle}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && reflection.trim()) {
                e.preventDefault();
                handleReflectionSubmit();
              }
            }}
          />
          <SubmitArrow active={!!reflection.trim()} onClick={handleReflectionSubmit} />
        </InputPill>
      );
    }

    // Run-only steps: hint
    if (currentStep.showRun) {
      return (
        <InputPill>
          <span style={hintTextStyle}>
            Make your change in the editor, then click <strong>Run</strong>.
          </span>
        </InputPill>
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

        {/* Bottom bar: Run or Resume */}
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
              {editorReady && !needsPrediction && <span style={{ fontSize: 11 }}>&#9654;</span>}
              {" "}{!editorReady ? "Loading Python..." : needsPrediction ? "Submit prediction first" : "Run"}
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

        {/* Scroll-to-bottom arrow */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            style={scrollToBottomBtnStyle}
            aria-label="Scroll to bottom"
          >
            &#8595;
          </button>
        )}

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
        <div style={{ padding: "12px 20px 16px", background: "var(--muted)" }}>
          {renderInputBar()}
        </div>
      </div>
    </div>
  );
}

/* ---- Shared sub-components ---- */

function InputPill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      padding: "12px 16px",
      background: "var(--background)",
      border: "1px solid var(--border)",
      borderRadius: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}>
      {children}
    </div>
  );
}

function SubmitArrow({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!active}
      style={{
        width: SUBMIT_BUTTON_SIZE,
        height: SUBMIT_BUTTON_SIZE,
        borderRadius: "50%",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: active ? "pointer" : "default",
        background: active ? "var(--primary)" : "var(--muted)",
        color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
        flexShrink: 0,
        fontSize: 16,
        transition: "background 0.15s, color 0.15s",
      }}
      aria-label="Submit"
    >
      &#8593;
    </button>
  );
}

function ChatCard({ children, muted, align }: {
  children: React.ReactNode;
  muted?: boolean;
  align?: "right";
}) {
  return (
    <div style={{
      marginTop: 12,
      padding: 16,
      background: muted ? "var(--muted)" : "var(--background)",
      borderRadius: 10,
      border: "1px solid var(--border)",
      ...(align === "right" ? { marginLeft: 40 } : {}),
    }}>
      {children}
    </div>
  );
}

function ComparisonCard({ prediction, output, selected, onClick }: {
  prediction: string;
  output: string;
  selected: boolean;
  onClick: () => void;
}) {
  const match = prediction.trim() === output.trim();
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
      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Your prediction</FieldLabel>
          <pre style={comparisonPreStyle}>{prediction}</pre>
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Actual output</FieldLabel>
          <pre style={comparisonPreStyle}>{output}</pre>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: match ? "var(--success)" : "var(--warning)",
        }}>
          {match ? "Exact match!" : "Not quite \u2014 spot the difference"}
        </span>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {selected ? "viewing code \u2190" : "click to view code"}
        </span>
      </div>
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
          {selected ? "viewing code \u2190" : "click to view code"}
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

/* ---- Styles ---- */

const metaLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--muted-foreground)",
};

const pillTextareaStyle: React.CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  resize: "none",
  fontSize: 14,
  lineHeight: 1.5,
  background: "transparent",
  color: "var(--foreground)",
  fontFamily: "inherit",
  minHeight: 24,
};

const hintTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--muted-foreground)",
  lineHeight: 1.5,
  flex: 1,
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

const comparisonPreStyle: React.CSSProperties = {
  margin: 0,
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "monospace",
  lineHeight: 1.5,
  background: "#0d1117",
  color: "#c9d1d9",
  borderRadius: 6,
  whiteSpace: "pre-wrap",
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

const scrollToBottomBtnStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 100,
  left: "50%",
  transform: "translateX(-50%)",
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid var(--border)",
  background: "var(--background)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  color: "var(--muted-foreground)",
  zIndex: 10,
};
