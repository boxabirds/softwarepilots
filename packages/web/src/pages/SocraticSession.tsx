import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../lib/api-client";
import { useIsMobile } from "../hooks/useIsMobile";
import { TutorCard } from "../components/exercise/TutorCard";
import { ChatCard } from "../components/exercise/ChatCard";
import { InputPill } from "../components/exercise/InputPill";
import { SubmitArrow } from "../components/exercise/SubmitArrow";

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

  // Mobile layout
  const isMobile = useIsMobile();
  const [contextOpen, setContextOpen] = useState(false);

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

    const userMsg: ConversationMessage = { role: "user", content: text };
    const updatedConversation = [...conversation, userMsg];
    setConversation(updatedConversation);
    setInputText("");
    setSending(true);

    try {
      const response = await apiClient.post<SocraticResponse>("/api/socratic", {
        profile,
        section_id: sectionId,
        message: text,
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

  /* ---- Context panel content ---- */

  function renderContextPanel() {
    if (sectionLoading) {
      return (
        <div className="p-5 text-sm text-muted-foreground">Loading section...</div>
      );
    }
    if (sectionError) {
      return (
        <div className="p-5 text-sm text-destructive">{sectionError}</div>
      );
    }
    if (!section) return null;

    const trackLabel = profile?.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "";

    return (
      <div className="p-5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {trackLabel}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">{section.module_title}</p>
        <h2 className="mt-2 text-lg font-bold text-foreground">{section.title}</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          The tutor will guide you through this section using Socratic questioning - probing your understanding rather than lecturing.
        </p>
        {conversation.length > 0 && (
          <button
            onClick={handleStartOver}
            className="mt-4 cursor-pointer rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Start Over
          </button>
        )}
      </div>
    );
  }

  /* ---- Conversation rendering ---- */

  function renderConversation() {
    const elements: React.ReactNode[] = [];

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
                <div className="text-[13px] leading-relaxed text-foreground">{msg.content}</div>
              </div>
            ) : (
              <TutorCard content={msg.content} />
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
        elements.push(
          <ChatCard key={i} align="right">
            <div className="text-[13px] leading-relaxed text-foreground">{msg.content}</div>
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

  /* ---- Input bar ---- */

  function renderInputBar() {
    return (
      <InputPill>
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your response..."
          rows={1}
          className="min-h-6 flex-1 resize-none border-none bg-transparent font-sans text-sm leading-relaxed text-foreground outline-none"
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && inputText.trim()) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <SubmitArrow active={!!inputText.trim() && !sending} onClick={handleSubmit} />
      </InputPill>
    );
  }

  /* ---- Layout ---- */

  // Mobile: slide-out drawer for context
  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col bg-muted">
        {/* Header with context toggle */}
        <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-foreground"
            aria-label="Toggle context panel"
          >
            {contextOpen ? "\u2715" : "\u2630"}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-foreground">
              {section?.title ?? "Loading..."}
            </h1>
          </div>
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
              {renderContextPanel()}
            </div>
            <div className="flex-1 bg-black/30" />
          </div>
        )}

        {/* Conversation */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4">
          {renderConversation()}
          {renderCompletionCard()}
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
        {!sessionComplete && (
          <div className="bg-muted px-4 pb-4 pt-3">
            {renderInputBar()}
          </div>
        )}
      </div>
    );
  }

  // Desktop: two-column layout
  return (
    <div className="flex h-dvh bg-muted">
      {/* Left column: context panel */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border bg-background">
        {renderContextPanel()}
      </div>

      {/* Right column: conversation */}
      <div className="relative flex flex-1 flex-col">
        {/* Conversation */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-5 py-4">
          {renderConversation()}
          {renderCompletionCard()}
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
        {!sessionComplete && (
          <div className="bg-muted px-5 pb-4 pt-3">
            {renderInputBar()}
          </div>
        )}
      </div>
    </div>
  );
}
