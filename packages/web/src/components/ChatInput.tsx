import { useRef, useEffect, useLayoutEffect } from "react";

const MAX_LINES = 7;
const LINE_HEIGHT = 24;
const MAX_HEIGHT = MAX_LINES * LINE_HEIGHT;
const QUOTE_PREVIEW_LENGTH = 100;

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  quotedMessage?: string | null;
  onDismissQuote?: () => void;
  placeholder?: string;
  feedbackMode?: boolean;
  feedbackMessage?: string | null;
  onDismissFeedback?: () => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  quotedMessage,
  onDismissQuote,
  placeholder = "Type your response...",
  feedbackMode = false,
  feedbackMessage,
  onDismissFeedback,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [feedbackMode]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Measure how many lines the content needs by temporarily
    // collapsing to 0 and reading scrollHeight
    el.style.height = "0";
    const scrolled = el.scrollHeight;
    // scrollHeight includes browser-internal textarea padding,
    // so round to the nearest multiple of LINE_HEIGHT to get
    // the actual number of content lines
    const lines = Math.max(1, Math.round(scrolled / LINE_HEIGHT));
    const targetHeight = Math.min(lines * LINE_HEIGHT, MAX_HEIGHT);
    el.style.height = targetHeight + "px";
    el.style.overflowY = targetHeight >= MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  const canSubmit = value.trim().length > 0 && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const truncatedQuote = quotedMessage
    ? quotedMessage.length > QUOTE_PREVIEW_LENGTH
      ? quotedMessage.slice(0, QUOTE_PREVIEW_LENGTH) + "..."
      : quotedMessage
    : null;

  const truncatedFeedbackQuote = feedbackMessage
    ? feedbackMessage.length > QUOTE_PREVIEW_LENGTH
      ? feedbackMessage.slice(0, QUOTE_PREVIEW_LENGTH) + "..."
      : feedbackMessage
    : null;

  const effectivePlaceholder = feedbackMode ? "Share your feedback..." : placeholder;

  return (
    <div
      className="rounded-xl px-4 py-2 shadow-sm"
      style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)" }}
    >
      {feedbackMode && (
        <>
          <div
            className="mb-2 flex items-center gap-2 rounded px-3 py-2"
            style={{ background: "rgba(234, 179, 8, 0.15)", color: "#facc15" }}
            data-testid="feedback-bar"
          >
            <span className="flex-1 text-[0.75rem] font-medium">
              Feedback: what would you like to say about this message?
            </span>
            <button
              onClick={onDismissFeedback}
              className="shrink-0 cursor-pointer border-none bg-transparent text-sm leading-none"
              style={{ color: "#facc15" }}
              aria-label="Dismiss feedback"
              data-testid="feedback-dismiss"
            >
              &times;
            </button>
          </div>
          {truncatedFeedbackQuote && (
            <div
              className="mb-2 flex items-start gap-2 rounded px-3 py-2"
              style={{ borderLeft: "2px solid var(--status-warning-border, #f59e0b)", background: "var(--bg-muted)" }}
              data-testid="feedback-quote"
            >
              <span className="flex-1 text-[0.75rem] italic" style={{ color: "var(--text-muted)" }}>
                {truncatedFeedbackQuote}
              </span>
            </div>
          )}
        </>
      )}
      {!feedbackMode && truncatedQuote && (
        <div
          className="mb-2 flex items-start gap-2 rounded px-3 py-2"
          style={{ borderLeft: "2px solid var(--pilot-blue)", background: "var(--bg-muted)" }}
          data-testid="quote-preview"
        >
          <span className="flex-1 text-[0.75rem] italic" style={{ color: "var(--text-muted)" }}>
            {truncatedQuote}
          </span>
          <button
            onClick={onDismissQuote}
            className="shrink-0 cursor-pointer border-none bg-transparent text-sm leading-none"
            style={{ color: "var(--text-muted)" }}
            aria-label="Dismiss quote"
            data-testid="quote-dismiss"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          rows={1}
          className="min-w-0 flex-1 resize-none border-none bg-transparent font-sans text-base outline-none"
          style={{ lineHeight: LINE_HEIGHT + "px", color: "var(--text-primary)", padding: 0 }}
        />
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex shrink-0 items-center justify-center rounded-full border-none text-sm transition-colors"
          style={{
            width: LINE_HEIGHT + "px",
            height: LINE_HEIGHT + "px",
            ...(canSubmit ? {
              background: "var(--pilot-blue)",
              color: "var(--text-on-brand)",
              cursor: "pointer",
            } : {
              background: "var(--bg-muted)",
              color: "var(--text-muted)",
              cursor: "default",
            }),
          }}
          aria-label="Submit"
        >
          &#8593;
        </button>
      </div>
    </div>
  );
}
