import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
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
}

interface SocraticResponse {
  reply: string;
  tool_type: string;
  topic?: string;
  confidence_assessment?: string;
  understanding_level?: string;
  learner_readiness?: string;
}

interface SectionMetadata {
  title: string;
  module_title?: string;
  track_name?: string;
  markdown?: string;
}

const SCROLL_BOTTOM_THRESHOLD = 50;
const CONTEXT_PREVIEW_LENGTH = 200;
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

  /* ---- Send opening probe on mount ---- */

  useEffect(() => {
    if (!profile || !sectionId) return;

    let cancelled = false;
    setSending(true);

    apiClient
      .post<SocraticResponse>("/api/socratic", {
        profile,
        section_id: sectionId,
        message: OPENING_MESSAGE,
        context: { conversation: [] },
      })
      .then((data) => {
        if (!cancelled) {
          setConversation([{ role: "tutor", content: data.reply }]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConversation([
            { role: "tutor", content: "Something went wrong connecting to the tutor. Please refresh to try again." },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setSending(false);
      });

    return () => { cancelled = true; };
  }, [profile, sectionId]);

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

      setConversation((prev) => [...prev, { role: "tutor", content: response.reply }]);
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
        setConversation((prev) => [...prev, { role: "tutor", content: response.reply }]);
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

  /* ---- Context panel content ---- */

  const contextPreview = section?.markdown
    ? section.markdown.slice(0, CONTEXT_PREVIEW_LENGTH) + (section.markdown.length > CONTEXT_PREVIEW_LENGTH ? "..." : "")
    : null;

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

    return (
      <div className="p-5">
        {section.track_name && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {section.track_name}
          </span>
        )}
        {section.module_title && (
          <p className="mt-1 text-xs text-muted-foreground">{section.module_title}</p>
        )}
        <h2 className="mt-2 text-lg font-bold text-foreground">{section.title}</h2>
        {contextPreview && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            {contextPreview}
          </p>
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
        elements.push(
          <div key={i}>
            <TutorCard content={msg.content} />
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
        <div className="bg-muted px-4 pb-4 pt-3">
          {renderInputBar()}
        </div>
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
        <div className="bg-muted px-5 pb-4 pt-3">
          {renderInputBar()}
        </div>
      </div>
    </div>
  );
}
