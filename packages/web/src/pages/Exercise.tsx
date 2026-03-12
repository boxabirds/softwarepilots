import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { CodeEditor, type CodeEditorHandle } from "../components/CodeEditor";
import { CodeSkeleton } from "../components/CodeSkeleton";
import { SelfAssessment } from "../components/SelfAssessment";
import { ScoreDisplay } from "../components/ScoreDisplay";
import { apiClient } from "../lib/api-client";
import { getExerciseContent, getExerciseRubric, type PyodideStep } from "@softwarepilots/shared";
import { getStepRendering } from "../config/step-rendering";
import {
  InputPill,
  SubmitArrow,
  ChatCard,
  ComparisonCard,
  OutputCard,
  TutorCard,
  StepPrompt,
  MobileTabBar,
  type MobileTab,
} from "../components/exercise";
import { useIsMobile } from "../hooks/useIsMobile";

/* ---- Types ---- */

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

interface ChatResponse {
  reply: string;
  on_topic: boolean;
  topic?: string;
  step_answer?: string;
}

const EDITOR_MIN_HEIGHT = 300;
const SCROLL_BOTTOM_THRESHOLD = 50;
const INTRO_STEP_INDEX = -1;

type Phase = "intro" | "steps" | "self-assessment" | "submitting" | "results";

/* ---- Kbd helper ---- */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block rounded-[3px] border border-border bg-muted px-1 py-px font-sans text-[10px]">
      {children}
    </kbd>
  );
}

const modKey = typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl";

/* ---- Helpers ---- */

function findFirstPredictionStep(steps: PyodideStep[]): number {
  return steps.findIndex((s) => s.type === "predict" || s.type === "edit-and-predict");
}

function findReflectionStep(steps: PyodideStep[]): number {
  return steps.findIndex((s) => s.type === "reflect");
}

/** Compute active step, pausing at experiment steps that need acknowledgment. */
function computeActiveStep(
  steps: PyodideStep[],
  snapshots: RunSnapshot[],
  acknowledgedSteps: Set<number>
): number {
  for (let i = 0; i < Math.min(snapshots.length, steps.length); i++) {
    const rendering = getStepRendering(steps[i].type);
    if (rendering.requiresAcknowledgment && !acknowledgedSteps.has(i)) {
      return i;
    }
  }
  return Math.min(snapshots.length, steps.length - 1);
}

/* ---- Component ---- */

export function Exercise() {
  const { moduleId, exerciseId } = useParams();
  const fullExerciseId = `${moduleId}.${exerciseId}` || "2.1";

  const exerciseContent = getExerciseContent(fullExerciseId);
  const rubric = getExerciseRubric(fullExerciseId);
  const steps = exerciseContent.steps;
  const title = exerciseContent.title;

  const editorRef = useRef<CodeEditorHandle>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const intro = exerciseContent.intro;
  const [phase, setPhase] = useState<Phase>(intro ? "intro" : "steps");
  const [code, setCode] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<RunSnapshot[]>([]);
  const [viewingSnapshot, setViewingSnapshot] = useState<number | null>(null);
  const [readyMessage, setReadyMessage] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showSnapshotPopup, setShowSnapshotPopup] = useState(false);

  const [inputText, setInputText] = useState("");
  const [submittedInputs, setSubmittedInputs] = useState<Record<number, string>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [acknowledgedSteps, setAcknowledgedSteps] = useState<Set<number>>(new Set());

  // Intro message sequencing
  const introMessages = intro?.welcome ?? [];
  const [introMessageIndex, setIntroMessageIndex] = useState(0);
  const allIntroMessagesShown = introMessageIndex >= introMessages.length - 1;

  // Mobile layout
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<MobileTab>("exercise");

  const activeStep = computeActiveStep(steps, snapshots, acknowledgedSteps);
  const currentStep = steps[activeStep];
  const currentRendering = getStepRendering(currentStep.type);

  const currentInputSubmitted = submittedInputs[activeStep] !== undefined;
  const inputGatesRun = currentRendering.inputGatesRun && !currentInputSubmitted;
  const runDisabled = !editorReady || (phase !== "steps") || viewingSnapshot !== null || inputGatesRun;

  // Experiment step waiting for acknowledgment
  const awaitingAcknowledgment =
    currentRendering.requiresAcknowledgment &&
    snapshots[activeStep] !== undefined &&
    !acknowledgedSteps.has(activeStep);

  const firstPredictionStepIndex = findFirstPredictionStep(steps);
  const firstPrediction = firstPredictionStepIndex >= 0 ? (submittedInputs[firstPredictionStepIndex] || "") : "";
  const reflectionStepIndex = findReflectionStep(steps);
  const reflection = reflectionStepIndex >= 0 ? (submittedInputs[reflectionStepIndex] || "") : "";

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

  useEffect(() => { scrollToBottom(); }, [snapshots.length, phase, submittedInputs, chatMessages.length, introMessageIndex, scrollToBottom]);

  /* ---- Step-driven focus management ---- */

  useEffect(() => {
    const timer = setTimeout(() => {
      if (phase !== "steps" || viewingSnapshot !== null) return;
      if (currentRendering.focus === "editor") {
        if (isMobile) setActiveTab("code");
        editorRef.current?.focus();
      } else if (currentRendering.focus === "input") {
        if (isMobile) setActiveTab("exercise");
        inputRef.current?.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeStep, currentInputSubmitted, phase, viewingSnapshot, currentRendering.focus, editorReady, isMobile]);

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

  /* ---- Spacebar / Enter to advance intro ---- */

  useEffect(() => {
    if (phase !== "intro") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        // Don't hijack if user is typing in the chat input
        if (document.activeElement?.tagName === "TEXTAREA") return;
        e.preventDefault();
        handleIntroAdvance();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  /* ---- Handlers ---- */

  const handleIntroAdvance = () => {
    if (!allIntroMessagesShown) {
      setIntroMessageIndex((prev) => prev + 1);
    } else {
      setPhase("steps");
    }
  };

  const handleRun = (output: string) => {
    setSnapshots((prev) => [...prev, { code, output }]);
    setReadyMessage(false);
    setInputText("");
    if (isMobile) setActiveTab("exercise");
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

  const handleAcknowledgeStep = () => {
    setAcknowledgedSteps((prev) => new Set(prev).add(activeStep));
  };

  const handleChatSubmit = async () => {
    const question = inputText.trim();
    if (!question || chatLoading) return;

    const chatStep = phase === "intro" ? INTRO_STEP_INDEX : activeStep;
    const userMsg: ChatMessage = { role: "user", content: question, atStep: chatStep };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setChatLoading(true);

    try {
      const response = await apiClient.post<ChatResponse>(
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

      // Handle step_answer extraction from LLM
      if (response.step_answer && currentRendering.hasInput && !currentInputSubmitted) {
        setSubmittedInputs((prev) => ({ ...prev, [activeStep]: response.step_answer! }));
        if (!currentRendering.showRun) {
          setPhase("self-assessment");
        }
      }

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

    if (intro) {
      for (let i = 0; i <= introMessageIndex && i < introMessages.length; i++) {
        elements.push(
          <TutorCard key={`intro-${i}`} content={introMessages[i]} />
        );
      }

      chatMessages
        .filter((msg) => msg.atStep === INTRO_STEP_INDEX)
        .forEach((msg, j) => {
          if (msg.role === "user") {
            elements.push(
              <ChatCard key={`intro-user-${j}`} align="right">
                <div className="rounded-r border-l-[3px] border-border bg-muted px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground">{msg.content}</div>
              </ChatCard>
            );
          } else {
            elements.push(
              <TutorCard key={`intro-tutor-${j}`} content={msg.content} />
            );
          }
        });
    }

    if (phase === "intro") {
      if (chatLoading) {
        elements.push(<TutorCard key="intro-loading" content="" loading />);
      }
      return elements;
    }

    for (let i = 0; i < steps.length; i++) {
      if (i > activeStep) break;

      const step = steps[i];
      const stepRendering = getStepRendering(step.type);

      elements.push(
        <ChatCard key={`prompt-${i}`}>
          <StepPrompt text={step.prompt} />
        </ChatCard>
      );

      const submitted = submittedInputs[i];
      if (submitted) {
        elements.push(
          <ChatCard key={`input-${i}`} align="right">
            <div className="rounded-r border-l-[3px] border-border bg-muted px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground">{submitted}</div>
          </ChatCard>
        );
      }

      if (submitted && stepRendering.showRun && !snapshots[i]) {
        elements.push(
          <ChatCard key={`run-hint-${i}`} muted>
            <span className="text-[13px] text-muted-foreground">
              Click <strong>Run</strong> to see if you were right.
              {" "}<span className="text-[11px]"><Kbd>{modKey}</Kbd>+<Kbd>Enter</Kbd></span>
            </span>
          </ChatCard>
        );
      }

      if (snapshots[i]) {
        const isSelected = viewingSnapshot === i;
        if (submitted && stepRendering.inputType === "prediction") {
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

        // Continue button for experiment steps awaiting acknowledgment
        if (
          stepRendering.requiresAcknowledgment &&
          !acknowledgedSteps.has(i) &&
          i === activeStep
        ) {
          elements.push(
            <ChatCard key={`ack-${i}`}>
              <button
                onClick={handleAcknowledgeStep}
                className="cursor-pointer rounded-[10px] border-none bg-primary px-6 py-3 text-center text-[15px] font-semibold text-primary-foreground transition-transform duration-100"
              >
                Continue
              </button>
            </ChatCard>
          );
        }
      }

      chatMessages
        .filter((msg) => msg.atStep === i)
        .forEach((msg, j) => {
          if (msg.role === "user") {
            elements.push(
              <ChatCard key={`chat-user-${i}-${j}`} align="right">
                <div className="rounded-r border-l-[3px] border-border bg-muted px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground">{msg.content}</div>
              </ChatCard>
            );
          } else {
            elements.push(
              <TutorCard key={`chat-tutor-${i}-${j}`} content={msg.content} />
            );
          }
        });
    }

    if (chatLoading) {
      elements.push(
        <TutorCard key="tutor-loading" content="" loading />
      );
    }

    if (readyMessage && phase === "steps") {
      elements.push(
        <ChatCard key="ready" muted>
          <span className="text-[13px] text-muted-foreground">
            Ready to test your new edits.
          </span>
        </ChatCard>
      );
    }

    if (phase === "submitting") {
      elements.push(
        <ChatCard key="submitting">
          <div className="flex items-center gap-2.5 py-1">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Evaluating...</span>
          </div>
        </ChatCard>
      );
    }

    if (phase === "results" && submissionId) {
      elements.push(
        <div key="results" className="mt-3 rounded-[10px] border border-border bg-background">
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
        <div className="flex flex-col gap-2.5">
          <InputPill>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask a question..."
              rows={1}
              className="min-h-6 flex-1 resize-none border-none bg-transparent font-sans text-sm leading-relaxed text-foreground outline-none"
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
          <button
            onClick={handleIntroAdvance}
            className="cursor-pointer rounded-[10px] border-none bg-primary px-6 py-3 text-center text-[15px] font-semibold text-primary-foreground transition-transform duration-100"
          >
            {allIntroMessagesShown ? "I\u2019m ready \u2014 let\u2019s start" : "Next"}
          </button>
        </div>
      );
    }
    if (phase === "submitting") {
      return <InputPill><span className="flex-1 text-[13px] leading-relaxed text-muted-foreground">Waiting for evaluation...</span></InputPill>;
    }
    if (phase === "results") {
      return <InputPill><span className="flex-1 text-[13px] leading-relaxed text-muted-foreground">Exercise complete.</span></InputPill>;
    }
    if (phase === "self-assessment") {
      return <InputPill><span className="flex-1 text-[13px] leading-relaxed text-muted-foreground">Complete self-assessment above...</span></InputPill>;
    }
    if (!currentStep) return null;

    // Context-sensitive placeholder: step input placeholder when pending, otherwise generic
    const placeholder =
      currentRendering.hasInput && !currentInputSubmitted
        ? currentStep.inputPlaceholder || "Type your answer..."
        : "Ask about what you see...";

    const runHint = currentRendering.showRun && !awaitingAcknowledgment ? (
      <div className="mb-1 pl-0.5 text-[11px] text-muted-foreground">
        {currentRendering.hasInput && currentInputSubmitted
          ? <>Click <strong>Run</strong> to test your prediction. <Kbd>{modKey}</Kbd>+<Kbd>Enter</Kbd></>
          : !currentRendering.hasInput
            ? <>Make your change, then <strong>Run</strong>. <Kbd>{modKey}</Kbd>+<Kbd>Enter</Kbd></>
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
            placeholder={placeholder}
            rows={currentRendering.hasInput && !currentInputSubmitted ? 2 : 1}
            className="min-h-6 flex-1 resize-none border-none bg-transparent font-sans text-sm leading-relaxed text-foreground outline-none"
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

  const codeTabDisabled = phase === "intro";
  const showEditorPanel = !isMobile || activeTab === "code";
  const showChatPanel = !isMobile || activeTab === "exercise";

  return (
    <div className="flex h-dvh flex-col bg-muted md:flex-row">

      {/* ===== Editor panel ===== */}
      <div className={`flex flex-col border-border bg-background md:w-1/2 md:border-r ${
        showEditorPanel ? "flex-1 md:flex" : "hidden"
      }`}>
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Module {moduleId} &middot; Exercise {exerciseId}
          </span>
          <h1 className="mt-1 text-xl font-bold">{title}</h1>
        </div>

        {/* Editor area */}
        <div className="relative flex-1" style={{ minHeight: isMobile ? undefined : EDITOR_MIN_HEIGHT }}>
          {phase === "intro" ? (
            <div className="absolute inset-0">
              <CodeSkeleton />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{ display: viewingSnapshot !== null ? "none" : "block" }}
            >
              <CodeEditor
                ref={editorRef}
                exerciseId={fullExerciseId}
                onCodeChange={setCode}
                onRun={handleRun}
                disabled={phase !== "steps"}
                onReadyChange={setEditorReady}
              />
            </div>
          )}

          {viewingSnapshot !== null && (
            <div
              className="absolute inset-0 flex flex-col"
              onDoubleClick={() => setShowSnapshotPopup(true)}
            >
              <div className="border-b border-border bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
                Viewing code from run #{viewingSnapshot + 1} (read-only)
              </div>
              <pre className="m-0 flex-1 overflow-y-auto whitespace-pre-wrap bg-[#1e1e1e] px-5 py-4 font-mono text-[13px] leading-relaxed text-[#d4d4d4]">
                {snapshots[viewingSnapshot].code}
              </pre>

              {showSnapshotPopup && (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/40"
                  onClick={() => setShowSnapshotPopup(false)}
                >
                  <div
                    className="rounded-xl border border-border bg-background px-6 py-5 text-center shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="mb-3 text-sm text-foreground">
                      This is from a previous run.
                    </p>
                    <button
                      onClick={() => {
                        setShowSnapshotPopup(false);
                        handleResumeEditing();
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border-none bg-primary px-4 py-[7px] text-[13px] font-medium text-primary-foreground"
                    >
                      Make another edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Undo hint (hidden on mobile to save space) */}
        {phase !== "intro" && (
          <div className="hidden border-t border-border px-5 py-1 text-center text-[11px] text-muted-foreground md:block">
            <Kbd>{modKey}</Kbd>+<Kbd>Z</Kbd> to undo edits
          </div>
        )}

        {/* Bottom bar: Run or Resume */}
        <div className={`flex justify-end px-5 pb-3 pt-2 ${phase === "intro" ? "hidden" : ""}`}>
          {viewingSnapshot !== null ? (
            <button
              onClick={handleResumeEditing}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border-none bg-primary px-4 py-[7px] text-[13px] font-medium text-primary-foreground"
            >
              Make another edit
            </button>
          ) : (
            <button
              onClick={handleRunClick}
              disabled={runDisabled}
              className={`inline-flex items-center gap-1 rounded-md border-none px-4 py-[7px] text-[13px] font-medium ${
                runDisabled
                  ? "cursor-default bg-muted text-muted-foreground"
                  : "cursor-pointer bg-primary text-primary-foreground"
              }`}
            >
              {editorReady && !inputGatesRun && <span className="text-[11px]">&#9654;</span>}
              {" "}{!editorReady ? "Loading Python..." : inputGatesRun ? "Submit your answer first" : "Run"}
            </button>
          )}
        </div>
      </div>

      {/* ===== Chat + input panel ===== */}
      <div className={`relative flex flex-col md:w-1/2 ${
        showChatPanel ? "flex-1 md:flex" : "hidden"
      }`}>
        {/* Scrollable chat area */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          {renderChat()}
        </div>

        {/* Scroll-to-bottom arrow */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-[100px] left-1/2 z-10 flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-lg text-muted-foreground shadow-md"
            aria-label="Scroll to bottom"
          >
            &#8595;
          </button>
        )}

        {/* Self-assessment popup */}
        {phase === "self-assessment" && (
          <div className="max-h-[60vh] overflow-y-auto border-t border-border bg-background p-5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            <SelfAssessment
              dimensions={rubric.dimensions}
              onSubmit={handleSelfAssessmentSubmit}
              onSkip={handleSkipSelfAssessment}
            />
          </div>
        )}

        {/* Fixed input bar */}
        <div className="bg-muted px-5 pb-4 pt-3">
          {renderInputBar()}
        </div>
      </div>

      {/* ===== Mobile tab bar ===== */}
      {isMobile && (
        <MobileTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          codeDisabled={codeTabDisabled}
        />
      )}
    </div>
  );
}
