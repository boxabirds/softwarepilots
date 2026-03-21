import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiClient } from "../lib/api-client";
import { useIsMobile } from "../hooks/useIsMobile";
import { TutorCard } from "../components/exercise/TutorCard";
import { ChatCard } from "../components/exercise/ChatCard";
import { ChatInput } from "../components/ChatInput";
import { getCurriculumSections } from "@softwarepilots/shared";
import { ProgressBadge } from "../components/ProgressBadge";
import { useTopicCoverage } from "../hooks/useTopicCoverage";

/* ---- Types ---- */

interface ConversationMessage {
  role: "user" | "tutor";
  content: string;
  tool_type?: string;
  concept?: string;
}

interface SocraticResponse {
  reply: string;
  tool_type: string;
  topic?: string;
  concept?: string;
  confidence_assessment?: string;
  understanding_level?: string;
  learner_readiness?: string;
  final_understanding?: string;
  concepts_covered?: string[];
  concepts_missed?: string[];
  recommendation?: string;
  pause_reason?: string;
  concepts_covered_so_far?: string;
  resume_suggestion?: string;
}

interface SectionMetadata {
  id: string;
  title: string;
  module_id: string;
  module_title: string;
  markdown: string;
  key_intuition: string;
}

const SCROLL_BOTTOM_THRESHOLD = 50;
const OPENING_MESSAGE = "I'm ready to begin.";
const RESUME_MESSAGE = "I'd like to continue where we left off.";
const QUOTE_TRUNCATE_LENGTH = 100;

/* ---- Component ---- */

export function SocraticSession() {
  const { profile, sectionId } = useParams<{ profile: string; sectionId: string }>();

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [section, setSection] = useState<SectionMetadata | null>(null);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [sessionComplete, setSessionComplete] = useState<SocraticResponse | null>(null);
  const [sessionPaused, setSessionPaused] = useState<SocraticResponse | null>(null);
  const [quotedMessage, setQuotedMessage] = useState<string | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<{ content: string; messageIndex: number } | null>(null);

  // Mobile layout
  const isMobile = useIsMobile();
  const [contextOpen, setContextOpen] = useState(false);
  const navigate = useNavigate();

  // Topic coverage for N/M badges
  const topicCoverage = useTopicCoverage(profile);

  // Module sections for the lesson list sidebar
  interface LessonItem { id: string; title: string; module_id: string; }
  const moduleSections = useMemo<LessonItem[]>(() => {
    if (!profile || !section) return [];
    try {
      const all = getCurriculumSections(profile);
      return all.filter((s) => s.module_id === section.module_id);
    } catch {
      return [];
    }
  }, [profile, section]);

  // Fetch progress for lesson list badges
  const [lessonProgress, setLessonProgress] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!profile) return;
    apiClient
      .get<Array<{ section_id: string; status: string }>>(`/api/curriculum/${profile}/progress`)
      .then((data) => {
        const map = new Map<string, string>();
        for (const p of data) map.set(p.section_id, p.status);
        setLessonProgress(map);
      })
      .catch(() => {});
  }, [profile]);

  /* ---- Fetch section metadata ---- */

  useEffect(() => {
    if (!profile || !sectionId) return;

    let cancelled = false;
    setSectionLoading(true);
    setSectionError(null);

    apiClient
      .get<SectionMetadata>(`/api/curriculum/${profile}/${sectionId}`)
      .then((data) => {
        if (!cancelled) {
          setSection(data);
          setSectionLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSectionError(err instanceof Error ? err.message : "Failed to load section");
          setSectionLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [profile, sectionId]);

  /* ---- Persistence helpers ---- */

  const conversationUrl = profile && sectionId
    ? `/api/curriculum/${profile}/${sectionId}/conversation`
    : null;

  /** Fire-and-forget save of the full conversation to the backend. */
  const saveConversation = useCallback(
    (messages: ConversationMessage[]) => {
      if (!conversationUrl || messages.length === 0) return;
      apiClient.put(conversationUrl, { messages }).catch(() => {
        // Silent failure - persistence is best-effort
      });
    },
    [conversationUrl],
  );

  /** Send the opening probe and return the resulting conversation. */
  const sendOpeningProbe = useCallback(
    async (cancelled: { current: boolean }) => {
      setSending(true);
      try {
        const data = await apiClient.post<SocraticResponse>("/api/socratic", {
          profile,
          section_id: sectionId,
          message: OPENING_MESSAGE,
          context: { conversation: [] },
        });
        if (!cancelled.current) {
          const initial: ConversationMessage[] = [{ role: "tutor", content: data.reply, tool_type: data.tool_type, concept: data.concept }];
          setConversation(initial);
          saveConversation(initial);
        }
      } catch {
        if (!cancelled.current) {
          setConversation([
            { role: "tutor", content: "Something went wrong connecting to the tutor. Please refresh to try again." },
          ]);
        }
      } finally {
        if (!cancelled.current) setSending(false);
      }
    },
    [profile, sectionId, saveConversation],
  );

  /* ---- Load saved conversation or send opening probe ---- */

  useEffect(() => {
    if (!profile || !sectionId || !conversationUrl) return;

    const cancelled = { current: false };

    (async () => {
      try {
        const saved = await apiClient.get<{ messages: ConversationMessage[]; updated_at: string | null }>(
          conversationUrl,
        );
        if (cancelled.current) return;

        if (saved.messages.length > 0) {
          setConversation(saved.messages);
          return;
        }
      } catch {
        // Failed to load saved conversation - fall through to opening probe
      }

      if (!cancelled.current) {
        await sendOpeningProbe(cancelled);
      }
    })();

    return () => { cancelled.current = true; };
  }, [profile, sectionId, conversationUrl, sendOpeningProbe]);

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

  useEffect(() => {
    scrollToBottom();
  }, [conversation.length, sending, scrollToBottom]);

  /* ---- Submit message ---- */

  const handleSubmit = async () => {
    const text = inputText.trim();
    if (!text || sending || !profile || !sectionId) return;

    // Handle feedback submission separately
    if (feedbackTarget) {
      setInputText("");
      const target = feedbackTarget;
      setFeedbackTarget(null);

      try {
        await apiClient.post(`/api/curriculum/${profile}/${sectionId}/feedback`, {
          message_content: target.content,
          message_index: target.messageIndex,
          feedback_text: text,
        });
        setConversation((prev) => [
          ...prev,
          { role: "tutor", content: "Feedback submitted \u2014 thank you!" },
        ]);
      } catch {
        setConversation((prev) => [
          ...prev,
          { role: "tutor", content: "Failed to submit feedback. Please try again." },
        ]);
      }
      return;
    }

    const messageContent = quotedMessage
      ? `> ${quotedMessage}\n\n${text}`
      : text;

    const userMsg: ConversationMessage = { role: "user", content: messageContent };
    const updatedConversation = [...conversation, userMsg];
    setConversation(updatedConversation);
    setInputText("");
    setQuotedMessage(null);
    setSending(true);

    try {
      const response = await apiClient.post<SocraticResponse>("/api/socratic", {
        profile,
        section_id: sectionId,
        message: messageContent,
        context: {
          conversation: updatedConversation.map(({ role, content }) => ({ role, content })),
        },
      });

      const withReply = [...updatedConversation, { role: "tutor" as const, content: response.reply, tool_type: response.tool_type, concept: response.concept }];
      setConversation(withReply);
      saveConversation(withReply);
      if (response.tool_type === "session_complete") {
        setSessionComplete(response);
      }
      if (response.tool_type?.includes("session_pause")) {
        setSessionPaused(response);
      }
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: "tutor", content: "Failed to reach the tutor. Please try again." },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleRetry = () => {
    // Remove the last error message and re-send the last user message
    let lastUserIndex = -1;
    for (let i = conversation.length - 1; i >= 0; i--) {
      if (conversation[i].role === "user") { lastUserIndex = i; break; }
    }
    if (lastUserIndex === -1) return;

    const lastUserMsg = conversation[lastUserIndex];
    // Remove everything after (and including) the error tutor message
    const trimmed = conversation.slice(0, lastUserIndex + 1);
    setConversation(trimmed);
    setSending(true);

    apiClient
      .post<SocraticResponse>("/api/socratic", {
        profile,
        section_id: sectionId,
        message: lastUserMsg.content,
        context: {
          conversation: trimmed.map(({ role, content }) => ({ role, content })),
        },
      })
      .then((response) => {
        setConversation((prev) => {
          const updated = [...prev, { role: "tutor" as const, content: response.reply, tool_type: response.tool_type, concept: response.concept }];
          saveConversation(updated);
          return updated;
        });
      })
      .catch(() => {
        setConversation((prev) => [
          ...prev,
          { role: "tutor", content: "Failed to reach the tutor. Please try again." },
        ]);
      })
      .finally(() => {
        setSending(false);
      });
  };

  /* ---- Start Over ---- */

  const handleStartOver = useCallback(async () => {
    if (!conversationUrl || !profile || !sectionId) return;
    if (!window.confirm("Start over? This will clear the current conversation.")) return;

    // Delete saved conversation on the backend (fire-and-forget)
    apiClient.delete(conversationUrl).catch(() => {});

    // Reset local state and send a fresh opening probe
    setConversation([]);
    const cancelled = { current: false };
    await sendOpeningProbe(cancelled);
  }, [conversationUrl, profile, sectionId, sendOpeningProbe]);

  /* ---- Continue from pause ---- */

  const handleContinueSession = useCallback(async () => {
    if (!profile || !sectionId) return;

    setSessionPaused(null);
    setSending(true);

    const resumeMsg: ConversationMessage = { role: "user", content: RESUME_MESSAGE };
    const updatedConversation = [...conversation, resumeMsg];
    setConversation(updatedConversation);

    try {
      const response = await apiClient.post<SocraticResponse>("/api/socratic", {
        profile,
        section_id: sectionId,
        message: RESUME_MESSAGE,
        context: {
          conversation: updatedConversation.map(({ role, content }) => ({ role, content })),
        },
      });
      const withReply = [...updatedConversation, { role: "tutor" as const, content: response.reply }];
      setConversation(withReply);
      saveConversation(withReply);
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: "tutor", content: "Failed to reach the tutor. Please try again." },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [profile, sectionId, conversation, saveConversation]);

  const handleReply = useCallback((content: string) => {
    setQuotedMessage(content);
    setFeedbackTarget(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleFeedback = useCallback((content: string, messageIndex: number) => {
    setFeedbackTarget({ content, messageIndex });
    setQuotedMessage(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  /* ---- Lesson list sidebar ---- */

  function renderLessonList() {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-0.5">
            {moduleSections.map((lesson) => {
              const isCurrent = lesson.id === sectionId;
              const status = lessonProgress.get(lesson.id);
              const sectionCov = topicCoverage?.sections.get(lesson.id);
              return (
                <li key={lesson.id}>
                  <button
                    onClick={() => {
                      if (!isCurrent) navigate(`/curriculum/${profile}/${lesson.id}`);
                      setContextOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
                    style={isCurrent ? {
                      background: "var(--pilot-blue)",
                      color: "var(--text-on-brand)",
                      fontWeight: 600,
                    } : {
                      color: "var(--text-secondary)",
                    }}
                  >
                    {status && (
                      <ProgressBadge
                        status={status as "not_started" | "in_progress" | "completed"}
                      />
                    )}
                    <span className="line-clamp-3">{lesson.title}</span>
                    {sectionCov && sectionCov.total > 0 && status && status !== "not_started" && (
                      <span className="ml-auto flex shrink-0 items-center gap-1">
                        {sectionCov.dueForReview && (
                          <span
                            className="inline-block size-2 rounded-full bg-amber-500"
                            data-testid={`review-dot-${lesson.id}`}
                            aria-label="Due for review"
                          />
                        )}
                        <span
                          className="text-[11px] tabular-nums text-muted-foreground"
                          data-testid={`section-coverage-${lesson.id}`}
                        >
                          {sectionCov.covered}/{sectionCov.total}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  /* ---- Conversation rendering ---- */

  function renderConversation() {
    const elements: React.ReactNode[] = [];

    // Intro message as the first tutor card
    if (section) {
      elements.push(
        <TutorCard
          key="intro"
          content={`Welcome to "${section.title}". The tutor will guide you through this section using Socratic questioning - probing your understanding rather than lecturing.`}
        />,
      );
    }

    for (let i = 0; i < conversation.length; i++) {
      const msg = conversation[i];
      if (msg.role === "tutor") {
        const isError = msg.content.startsWith("Failed to reach the tutor");
        const isInstruction = msg.tool_type?.includes("provide_instruction");
        elements.push(
          <div key={i}>
            {isInstruction ? (
              <div
                className="mr-10 mt-3 rounded-[10px] border border-blue-200 border-l-[3px] border-l-blue-500 bg-blue-50 p-4 dark:border-blue-800 dark:border-l-blue-400 dark:bg-blue-950/30"
                data-testid="instruction-card"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-base" aria-hidden="true">&#128161;</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    Direct Instruction
                  </span>
                </div>
                {msg.concept && (
                  <span
                    className="mb-2 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    data-testid="instruction-concept"
                  >
                    {msg.concept}
                  </span>
                )}
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{msg.content}</div>
              </div>
            ) : (
              <TutorCard
                content={msg.content}
                onReply={isError || i === conversation.length - 1 ? undefined : () => handleReply(msg.content)}
                onFeedback={isError || i === conversation.length - 1 ? undefined : () => handleFeedback(msg.content, i)}
              />
            )}
            {isError && (
              <button
                onClick={handleRetry}
                className="ml-4 mt-1 cursor-pointer border-none bg-transparent text-[13px] font-medium text-primary underline"
              >
                Retry
              </button>
            )}
          </div>
        );
      } else {
        const hasQuote = msg.content.startsWith("> ");
        let quoteText: string | null = null;
        let responseText = msg.content;

        if (hasQuote) {
          const splitIndex = msg.content.indexOf("\n\n");
          if (splitIndex !== -1) {
            quoteText = msg.content.slice(2, splitIndex);
            responseText = msg.content.slice(splitIndex + 2);
          }
        }

        const truncatedQuoteDisplay = quoteText && quoteText.length > QUOTE_TRUNCATE_LENGTH
          ? quoteText.slice(0, QUOTE_TRUNCATE_LENGTH) + "..."
          : quoteText;

        elements.push(
          <ChatCard key={i} align="right">
            {truncatedQuoteDisplay && (
              <div
                className="mb-2 border-l-2 border-muted-foreground/30 bg-background px-3 py-1.5 text-[12px] italic text-muted-foreground"
                data-testid="user-quote-block"
              >
                {truncatedQuoteDisplay}
              </div>
            )}
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{responseText}</div>
          </ChatCard>
        );
      }
    }

    if (sending) {
      elements.push(<TutorCard key="loading" content="" loading />);
    }

    return elements;
  }

  /* ---- Completion card ---- */

  function renderCompletionCard() {
    if (!sessionComplete) return null;

    return (
      <div
        className="mx-4 my-4 rounded-xl border-2 border-green-500 bg-green-50 p-5 dark:border-green-400 dark:bg-green-950/30"
        data-testid="session-complete-card"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">&#10003;</span>
          <h3 className="text-base font-semibold text-green-800 dark:text-green-300">
            Section Complete
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-green-900 dark:text-green-200">
          {sessionComplete.reply}
        </p>
        {sessionComplete.final_understanding && (
          <p className="mt-2 text-xs text-green-700 dark:text-green-400">
            Understanding: <span className="font-medium">{sessionComplete.final_understanding}</span>
          </p>
        )}
        {sessionComplete.concepts_covered && sessionComplete.concepts_covered.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {sessionComplete.concepts_covered.map((concept) => (
              <span
                key={concept}
                className="rounded-full bg-green-200 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-800 dark:text-green-200"
              >
                {concept}
              </span>
            ))}
          </div>
        )}
        {sessionComplete.recommendation && (
          <p className="mt-3 text-xs italic text-green-700 dark:text-green-400">
            {sessionComplete.recommendation}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <Link
            to={`/curriculum/${profile}`}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Back to Curriculum
          </Link>
        </div>
      </div>
    );
  }

  /* ---- Pause card ---- */

  function renderPauseCard() {
    if (!sessionPaused) return null;

    return (
      <div
        className="mx-4 my-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-5 dark:border-amber-400 dark:bg-amber-950/30"
        data-testid="session-pause-card"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">&#9208;</span>
          <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
            Session Paused
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">
          {sessionPaused.reply}
        </p>
        {sessionPaused.resume_suggestion && (
          <p className="mt-2 text-xs italic text-amber-700 dark:text-amber-400">
            {sessionPaused.resume_suggestion}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <Link
            to={`/curriculum/${profile}`}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            data-testid="resume-later-button"
          >
            Resume Later
          </Link>
          <button
            onClick={handleContinueSession}
            className="cursor-pointer rounded-md border border-amber-500 bg-transparent px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
            data-testid="continue-session-button"
          >
            Continue Session
          </button>
        </div>
      </div>
    );
  }

  /* ---- Input bar ---- */

  function renderInputBar() {
    return (
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSubmit={handleSubmit}
        disabled={sending}
        quotedMessage={quotedMessage}
        onDismissQuote={() => setQuotedMessage(null)}
        feedbackMode={feedbackTarget !== null}
        feedbackMessage={feedbackTarget?.content ?? null}
        onDismissFeedback={() => setFeedbackTarget(null)}
      />
    );
  }

  /* ---- Layout ---- */

  // Mobile: slide-out drawer for context
  if (isMobile) {
    return (
      <div className="flex h-[calc(100dvh-56px)] flex-col" style={{ background: "var(--bg-base)" }}>
        {/* Header with lesson list toggle */}
        <div className="flex items-center gap-3 px-4 py-2" style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border-light)" }}>
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground"
            aria-label="Toggle lesson list"
          >
            {contextOpen ? "\u2715" : "\u2630"}
          </button>
          <span className="truncate text-sm font-medium text-foreground">
            {section?.title ?? "Loading..."}
          </span>
        </div>

        {/* Slide-out drawer */}
        {contextOpen && (
          <div
            className="absolute inset-0 top-[44px] z-20 flex"
            onClick={() => setContextOpen(false)}
          >
            <div
              className="h-full w-4/5 max-w-sm overflow-y-auto border-r border-border bg-background shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {renderLessonList()}
            </div>
            <div className="flex-1 bg-black/30" />
          </div>
        )}

        {/* Conversation */}
        <div className="relative flex-1">
          <div ref={chatRef} className="absolute inset-0 overflow-y-auto px-4 py-4 pb-24">
            {renderConversation()}
            {renderCompletionCard()}
            {renderPauseCard()}
          </div>

          {/* Scroll-to-bottom */}
          {!isAtBottom && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-24 left-1/2 z-10 flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-lg text-muted-foreground shadow-md"
              aria-label="Scroll to bottom"
            >
              &#8595;
            </button>
          )}

          {/* Input - floats over conversation */}
          {!sessionComplete && !sessionPaused && (
            <div className="absolute right-0 bottom-0 left-0 px-4 pb-4 pt-3 backdrop-blur-sm" style={{ background: "var(--overlay-bg)" }}>
              {renderInputBar()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: two-column layout with resizable sidebar
  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 500;
  const SIDEBAR_KEY = "sp-sidebar-width";
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      if (saved) return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, parseInt(saved, 10)));
    } catch {}
    return 280;
  });
  const resizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + ev.clientX - startX));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      resizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try { localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth)); } catch {}
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth)); } catch {}
  }, [sidebarWidth]);

  return (
    <div className="flex h-[calc(100dvh-56px)]" style={{ background: "var(--bg-base)" }}>
      {/* Left column: lesson list (resizable) */}
      <div
        className="flex shrink-0 flex-col"
        style={{ width: sidebarWidth, background: "var(--sidebar-bg)", borderRight: "1px solid var(--border-light)" }}
      >
        {renderLessonList()}
      </div>
      {/* Resize handle */}
      <div
        className="w-1 shrink-0 cursor-col-resize transition-colors hover:bg-[var(--pilot-cyan)]"
        onMouseDown={handleResizeStart}
        style={{ background: "transparent" }}
      />

      {/* Right column: conversation */}
      <div className="relative flex flex-1 flex-col">
        {/* Conversation */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-5 py-4 pb-24">
          {renderConversation()}
          {renderCompletionCard()}
          {renderPauseCard()}
        </div>

        {/* Scroll-to-bottom */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-24 left-1/2 z-10 flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-lg text-muted-foreground shadow-md"
            aria-label="Scroll to bottom"
          >
            &#8595;
          </button>
        )}

        {/* Input - floats over conversation */}
        {!sessionComplete && !sessionPaused && (
          <div className="absolute right-0 bottom-0 left-0 px-5 pb-4 pt-3 backdrop-blur-sm" style={{ background: "var(--overlay-bg)" }}>
            {renderInputBar()}
          </div>
        )}
      </div>
    </div>
  );
}
