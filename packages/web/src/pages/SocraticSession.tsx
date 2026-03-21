import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiClient } from "../lib/api-client";
import { useIsMobile } from "../hooks/useIsMobile";
import { TutorCard } from "../components/exercise/TutorCard";
import { ChatCard } from "../components/exercise/ChatCard";
import { InputPill } from "../components/exercise/InputPill";
import { SubmitArrow } from "../components/exercise/SubmitArrow";
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
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      isCurrent
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {status && (
                      <ProgressBadge
                        status={status as "not_started" | "in_progress" | "completed"}
                      />
                    )}
                    <span className="truncate">{lesson.title}</span>
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
                onReply={isError ? undefined : () => handleReply(msg.content)}
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
                className="mb-2 border-l-2 border-muted-foreground/30 bg-muted/40 px-3 py-1.5 text-[12px] italic text-muted-foreground"
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
    const truncatedQuote = quotedMessage && quotedMessage.length > QUOTE_TRUNCATE_LENGTH
      ? quotedMessage.slice(0, QUOTE_TRUNCATE_LENGTH) + "..."
      : quotedMessage;

    return (
      <InputPill>
        <div className="flex flex-1 flex-col">
          {quotedMessage && (
            <div
              className="mb-2 flex w-full items-start gap-2 rounded border-l-2 border-primary/40 bg-muted/60 px-3 py-2"
              data-testid="quote-preview"
            >
              <span className="flex-1 text-[12px] italic text-muted-foreground">{truncatedQuote}</span>
              <button
                onClick={() => setQuotedMessage(null)}
                className="shrink-0 cursor-pointer border-none bg-transparent text-[14px] leading-none text-muted-foreground hover:text-foreground"
                aria-label="Dismiss quote"
                data-testid="quote-dismiss"
              >
                &times;
              </button>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your response..."
            rows={1}
            className="flex-1 resize-none overflow-hidden border-none bg-transparent font-sans text-sm leading-relaxed text-foreground outline-none"
            style={{ maxHeight: "7.5rem" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
              if (el.scrollHeight > 120) el.style.overflow = "auto";
              else el.style.overflow = "hidden";
            }}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.shiftKey && inputText.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
        <SubmitArrow active={!!inputText.trim() && !sending} onClick={handleSubmit} />
      </InputPill>
    );
  }

  /* ---- Layout ---- */

  // Mobile: slide-out drawer for context
  if (isMobile) {
    return (
      <div className="flex h-[calc(100dvh-56px)] flex-col bg-muted">
        {/* Header with lesson list toggle */}
        <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-2">
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-foreground"
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
            className="absolute inset-0 z-20 flex"
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
        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4">
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

        {/* Input */}
        {!sessionComplete && !sessionPaused && (
          <div className="bg-muted px-4 pb-4 pt-3">
            {renderInputBar()}
          </div>
        )}
      </div>
    );
  }

  // Desktop: two-column layout
  return (
    <div className="flex h-[calc(100dvh-56px)] bg-muted">
      {/* Left column: context panel */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border bg-background">
        {renderLessonList()}
      </div>

      {/* Right column: conversation */}
      <div className="relative flex flex-1 flex-col">
        {/* Conversation */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-5 py-4">
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

        {/* Input */}
        {!sessionComplete && !sessionPaused && (
          <div className="bg-muted px-5 pb-4 pt-3">
            {renderInputBar()}
          </div>
        )}
      </div>
    </div>
  );
}
