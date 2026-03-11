import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { CodeEditor, type CodeEditorHandle } from "../components/CodeEditor";
import { SelfAssessment } from "../components/SelfAssessment";
import { ScoreDisplay } from "../components/ScoreDisplay";
import { apiClient } from "../lib/api-client";

/* ---- Exercise step definitions ---- */

interface ExerciseStep {
  prompt: string;
  input?: {
    type: "prediction" | "reflection";
    placeholder: string;
  };
  showRun?: boolean;
  focus?: "editor" | "input";
}

interface RunSnapshot {
  code: string;
  output: string;
}

interface ChatMessage {
  role: "user" | "tutor";
  content: string;
  atStep: number;
  onTopic?: boolean;
}

const EXERCISE_STEPS: Record<string, ExerciseStep[]> = {
  "2.1": [
    {
      prompt: "Read the code. **What do you think it will print?**",
      input: { type: "prediction", placeholder: "Type your prediction..." },
      showRun: true,
      focus: "input",
    },
    {
      prompt: "Now try removing `str()` from line 3 and run again. What happens?",
      showRun: true,
      focus: "editor",
    },
    {
      prompt: "Make one more change of your own. **What do you think will happen?**",
      input: { type: "prediction", placeholder: "Type your prediction..." },
      showRun: true,
      focus: "editor",
    },
    {
      prompt: "**What did you change, and what did you learn?**",
      input: { type: "reflection", placeholder: "What did you change and what did you learn?" },
      focus: "input",
    },
  ],
};

const EXERCISE_TITLES: Record<string, string> = {
  "2.1": "The Compiler Moment",
};

const EXERCISE_INTROS: Record<string, { welcome: string }> = {
  "2.1": {
    welcome:
      "You're about to look at 5 lines of Python. You don't need to know Python \u2014 just read each line carefully and try to figure out what it does.\n\nThis exercise is about feeling how precise a computer is. It does exactly what it's told, nothing more, nothing less. You'll predict what the code will do, run it, and see if you were right.\n\nWhen you're ready, hit the button below.",
  },
};

const EDITOR_MIN_HEIGHT = 300;
const SCROLL_BOTTOM_THRESHOLD = 50;
const SUBMIT_BUTTON_SIZE = 32;
const FIRST_PREDICTION_STEP = 0;
const MAX_TUTOR_QUESTIONS = 30;

type Phase = "intro" | "steps" | "self-assessment" | "submitting" | "results";

const INTRO_STEP_INDEX = -1;
const EDITOR_INTRO_OPACITY = 0.3;

/* ---- Component ---- */

export function Exercise() {
  const { moduleId, exerciseId } = useParams();
  const fullExerciseId = `${moduleId}.${exerciseId}` || "2.1";

  const steps = EXERCISE_STEPS[fullExerciseId] || [];
  const title = EXERCISE_TITLES[fullExerciseId] || "Exercise";

  const editorRef = useRef<CodeEditorHandle>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const intro = EXERCISE_INTROS[fullExerciseId];
  const [phase, setPhase] = useState<Phase>(intro ? "intro" : "steps");
  const [code, setCode] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<RunSnapshot[]>([]);
  const [viewingSnapshot, setViewingSnapshot] = useState<number | null>(null);
  const [readyMessage, setReadyMessage] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showSnapshotPopup, setShowSnapshotPopup] = useState(false);

  // Per-step input: text the user types in the input bar
  const [inputText, setInputText] = useState("");
  // Submitted inputs indexed by step number
  const [submittedInputs, setSubmittedInputs] = useState<Record<number, string>>({});
  // Tutor conversation
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const activeStep = Math.min(snapshots.length, steps.length - 1);
  const currentStep = steps[activeStep];

  // Has the current step's required input been submitted?
  const currentInputSubmitted = submittedInputs[activeStep] !== undefined;
  // Run is gated if the step has input that must be submitted first
  const inputGatesRun = currentStep?.input && currentStep?.showRun && !currentInputSubmitted;
  const runDisabled = !editorReady || (phase !== "steps") || viewingSnapshot !== null || !!inputGatesRun;

  const tutorQuestionsUsed = chatMessages.filter((m) => m.role === "user").length;
  const tutorLimitReached = tutorQuestionsUsed >= MAX_TUTOR_QUESTIONS;

  // Convenience accessors for the API
  const firstPrediction = submittedInputs[FIRST_PREDICTION_STEP] || "";
  const reflectionStep = steps.findIndex((s) => s.input?.type === "reflection");
  const reflection = submittedInputs[reflectionStep] || "";

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

  useEffect(() => { scrollToBottom(); }, [snapshots.length, phase, submittedInputs, chatMessages.length, scrollToBottom]);

  /* ---- Step-driven focus management ---- */

  useEffect(() => {
    // Small delay to let the DOM settle after step transitions
    const timer = setTimeout(() => {
      if (phase !== "steps" || viewingSnapshot !== null) return;
      if (currentStep?.focus === "editor") {
        editorRef.current?.focus();
      } else if (currentStep?.focus === "input") {
        inputRef.current?.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeStep, currentInputSubmitted, phase, viewingSnapshot, currentStep?.focus, editorReady]);

  /* ---- Ctrl+Enter for Run ---- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !runDisabled) {
        e.preventDefault();
        editorRef.current?.run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runDisabled]);

  /* ---- Handlers ---- */

  const handleReady = () => {
    setPhase("steps");
    // Focus will be handled by the step-driven focus effect
  };

  const handleRun = (output: string) => {
    setSnapshots((prev) => [...prev, { code, output }]);
    setReadyMessage(false);
    setInputText(""); // clear for next step
  };

  const handleRunClick = () => {
    editorRef.current?.run();
  };

  const handleSnapshotClick = (index: number) => {
    setViewingSnapshot(index);
  };

  const handleResumeEditing = () => {
    setViewingSnapshot(null);
    setShowSnapshotPopup(false);
    setReadyMessage(true);
    scrollToBottom();
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const handleInputSubmit = () => {
    if (!inputText.trim()) return;
    setSubmittedInputs((prev) => ({ ...prev, [activeStep]: inputText.trim() }));
    setInputText("");

    // If this step has no Run (e.g. reflection), trigger evaluation
    if (!currentStep?.showRun) {
      setPhase("self-assessment");
    } else {
      // Input submitted, user now needs to Run — focus editor
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  };

  const handleChatSubmit = async () => {
    const question = inputText.trim();
    if (!question || chatLoading || tutorLimitReached) return;

    const chatStep = phase === "intro" ? INTRO_STEP_INDEX : activeStep;
    const userMsg: ChatMessage = { role: "user", content: question, atStep: chatStep };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setChatLoading(true);

    try {
      const response = await apiClient.post<{ reply: string; on_topic: boolean; topic?: string }>(
        "/api/chat",
        {
          exercise_id: fullExerciseId,
          message: question,
          context: {
            current_step: activeStep,
            code,
            snapshots,
            submitted_inputs: submittedInputs,
            conversation: [...chatMessages, userMsg].map(({ role, content }) => ({ role, content })),
          },
        }
      );
      setChatMessages((prev) => [
        ...prev,
        { role: "tutor", content: response.reply, atStep: chatStep, onTopic: response.on_topic },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "tutor", content: "Couldn't reach the tutor. Try again.", atStep: chatStep, onTopic: true },
      ]);
    } finally {
      setChatLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const submitToApi = async (
    selfAssessment?: { predictions: Record<string, number>; weakest_dimension: string }
  ) => {
    setPhase("submitting");

    const modifications: string[] = [];
    if (reflection) modifications.push(reflection);

    try {
      const payload: Record<string, unknown> = {
        module_id: moduleId,
        exercise_id: fullExerciseId,
        content: {
          code,
          console_output: snapshots[snapshots.length - 1]?.output || "",
          prediction: firstPrediction,
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

    // Intro welcome message + intro chat messages
    if (intro) {
      elements.push(
        <TutorCard key="intro-welcome" content={intro.welcome} />
      );

      chatMessages
        .filter((msg) => msg.atStep === INTRO_STEP_INDEX)
        .forEach((msg, j) => {
          if (msg.role === "user") {
            elements.push(
              <ChatCard key={`intro-user-${j}`} align="right">
                <div style={quotedBlockStyle}>{msg.content}</div>
              </ChatCard>
            );
          } else {
            elements.push(
              <TutorCard key={`intro-tutor-${j}`} content={msg.content} />
            );
          }
        });
    }

    // Don't render step content during intro
    if (phase === "intro") {
      if (chatLoading) {
        elements.push(<TutorCard key="intro-loading" content="" loading />);
      }
      return elements;
    }

    for (let i = 0; i < steps.length; i++) {
      if (i > activeStep) break;

      const step = steps[i];

      // Step prompt
      elements.push(
        <ChatCard key={`prompt-${i}`}>
          <StepPrompt text={step.prompt} />
        </ChatCard>
      );

      // Submitted input for this step
      const submitted = submittedInputs[i];
      if (submitted) {
        elements.push(
          <ChatCard key={`input-${i}`} align="right">
            <div style={quotedBlockStyle}>{submitted}</div>
          </ChatCard>
        );
      }

      // Waiting-for-run hint (input submitted but not yet run)
      if (submitted && step.showRun && !snapshots[i]) {
        elements.push(
          <ChatCard key={`run-hint-${i}`} muted>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              Click <strong>Run</strong> to see if you were right.
              {" "}<span style={{ fontSize: 11 }}>(<kbd style={kbdStyle}>{navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}</kbd>+<kbd style={kbdStyle}>Enter</kbd>)</span>
            </span>
          </ChatCard>
        );
      }

      // Output: comparison card for any step with a prediction, regular output for others
      if (snapshots[i]) {
        const isSelected = viewingSnapshot === i;
        if (submitted && steps[i].input?.type === "prediction") {
          elements.push(
            <ComparisonCard
              key={`comparison-${i}`}
              prediction={submitted}
              output={snapshots[i].output}
              selected={isSelected}
              onClick={() => handleSnapshotClick(i)}
            />
          );
        } else {
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

      // Tutor conversation for this step
      chatMessages
        .filter((msg) => msg.atStep === i)
        .forEach((msg, j) => {
          if (msg.role === "user") {
            elements.push(
              <ChatCard key={`chat-user-${i}-${j}`} align="right">
                <div style={quotedBlockStyle}>{msg.content}</div>
              </ChatCard>
            );
          } else {
            elements.push(
              <TutorCard key={`chat-tutor-${i}-${j}`} content={msg.content} />
            );
          }
        });
    }

    // Tutor typing indicator
    if (chatLoading) {
      elements.push(
        <TutorCard key="tutor-loading" content="" loading />
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
    if (phase === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <InputPill>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask a question..."
              rows={1}
              style={pillTextareaStyle}
              disabled={chatLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && inputText.trim()) {
                  e.preventDefault();
                  handleChatSubmit();
                }
              }}
            />
            <SubmitArrow active={!!inputText.trim() && !chatLoading} onClick={handleChatSubmit} />
          </InputPill>
          <button onClick={handleReady} style={readyBtnStyle}>
            I'm ready — let's start
          </button>
        </div>
      );
    }
    if (phase === "submitting") {
      return <InputPill><span style={hintTextStyle}>Waiting for evaluation...</span></InputPill>;
    }
    if (phase === "results") {
      return <InputPill><span style={hintTextStyle}>Exercise complete.</span></InputPill>;
    }
    if (phase === "self-assessment") {
      return <InputPill><span style={hintTextStyle}>Complete self-assessment above...</span></InputPill>;
    }
    if (!currentStep) return null;

    // Step has input and it hasn't been submitted yet: show textarea
    if (currentStep.input && !currentInputSubmitted) {
      return (
        <InputPill>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={currentStep.input.placeholder}
            rows={2}
            style={pillTextareaStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && inputText.trim()) {
                e.preventDefault();
                handleInputSubmit();
              }
            }}
          />
          <SubmitArrow active={!!inputText.trim()} onClick={handleInputSubmit} />
        </InputPill>
      );
    }

    // Tutor question mode: available when step input is already submitted or step has no input
    if (tutorLimitReached) {
      return (
        <InputPill>
          <span style={hintTextStyle}>You've used your tutor questions for this exercise.</span>
        </InputPill>
      );
    }

    // Show question textarea with contextual hint above
    const runHint = currentStep.showRun ? (
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, paddingLeft: 2 }}>
        {currentStep.input && currentInputSubmitted
          ? <>Click <strong>Run</strong> to test your prediction. <kbd style={kbdStyle}>{navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}</kbd>+<kbd style={kbdStyle}>Enter</kbd></>
          : !currentStep.input
            ? <>Make your change, then <strong>Run</strong>. <kbd style={kbdStyle}>{navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}</kbd>+<kbd style={kbdStyle}>Enter</kbd></>
            : null}
      </div>
    ) : null;

    return (
      <div>
        {runHint}
        <InputPill>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about what you see..."
            rows={1}
            style={pillTextareaStyle}
            disabled={chatLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && inputText.trim()) {
                e.preventDefault();
                handleChatSubmit();
              }
            }}
          />
          <SubmitArrow active={!!inputText.trim() && !chatLoading} onClick={handleChatSubmit} />
        </InputPill>
      </div>
    );
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
            opacity: phase === "intro" ? EDITOR_INTRO_OPACITY : 1,
            pointerEvents: phase === "intro" ? "none" : "auto",
            transition: "opacity 0.3s ease",
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
            <div
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}
              onDoubleClick={() => setShowSnapshotPopup(true)}
            >
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

              {showSnapshotPopup && (
                <div
                  style={popupOverlayStyle}
                  onClick={() => setShowSnapshotPopup(false)}
                >
                  <div
                    style={popupCardStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--foreground)" }}>
                      This is from a previous run.
                    </p>
                    <button
                      onClick={() => {
                        setShowSnapshotPopup(false);
                        handleResumeEditing();
                      }}
                      style={btnPrimary}
                    >
                      Make another edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Undo hint (hidden during intro) */}
        {phase !== "intro" && (
          <div style={{
            padding: "4px 20px",
            borderTop: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--muted-foreground)",
            textAlign: "center",
          }}>
            <kbd style={kbdStyle}>{navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}</kbd>+<kbd style={kbdStyle}>Z</kbd> to undo edits
          </div>
        )}

        {/* Bottom bar: Run or Resume (hidden during intro) */}
        <div style={{
          padding: "8px 20px 12px",
          display: phase === "intro" ? "none" : "flex",
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
              {editorReady && !inputGatesRun && <span style={{ fontSize: 11 }}>&#9654;</span>}
              {" "}{!editorReady ? "Loading Python..." : inputGatesRun ? "Submit your answer first" : "Run"}
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

function TutorCard({ content, loading }: { content: string; loading?: boolean }) {
  return (
    <div style={tutorCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: loading ? 0 : 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Tutor
        </span>
      </div>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
          <div style={spinnerStyle} />
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Thinking...</span>
        </div>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--foreground)" }}>{content}</div>
      )}
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

const popupOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.4)",
  zIndex: 20,
};

const popupCardStyle: React.CSSProperties = {
  padding: "20px 24px",
  background: "var(--background)",
  borderRadius: 12,
  border: "1px solid var(--border)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  textAlign: "center",
};

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 4px",
  fontSize: 10,
  fontFamily: "inherit",
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 3,
};

const tutorCardStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  background: "var(--muted)",
  borderRadius: 10,
  border: "1px solid var(--border)",
  borderLeft: "3px solid var(--primary)",
  marginRight: 40,
};

const readyBtnStyle: React.CSSProperties = {
  padding: "12px 24px",
  fontSize: 15,
  fontWeight: 600,
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  background: "var(--primary)",
  color: "var(--primary-foreground)",
  textAlign: "center",
  transition: "transform 0.1s ease",
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
