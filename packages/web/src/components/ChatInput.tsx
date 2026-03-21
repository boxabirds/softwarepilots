import { useRef, useLayoutEffect } from "react";

const MAX_LINES = 7;
const LINE_HEIGHT = 20; // matches leading-5 (1.25rem = 20px)
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
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  quotedMessage,
  onDismissQuote,
  placeholder = "Type your response...",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: runs before paint so no flicker
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Collapse to measure natural content height
    el.style.height = "auto";
    const contentHeight = el.scrollHeight;
    if (contentHeight > MAX_HEIGHT) {
      el.style.height = MAX_HEIGHT + "px";
      el.style.overflowY = "auto";
    } else {
      el.style.height = contentHeight + "px";
      el.style.overflowY = "hidden";
    }
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

  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
      {/* Quote preview */}
      {truncatedQuote && (
        <div
          className="mb-2 flex items-start gap-2 rounded border-l-2 border-primary/40 bg-muted/60 px-3 py-2"
          data-testid="quote-preview"
        >
          <span className="flex-1 text-[12px] italic text-muted-foreground">
            {truncatedQuote}
          </span>
          <button
            onClick={onDismissQuote}
            className="shrink-0 cursor-pointer border-none bg-transparent text-sm leading-none text-muted-foreground hover:text-foreground"
            aria-label="Dismiss quote"
            data-testid="quote-dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-w-0 flex-1 resize-none border-none bg-transparent font-sans text-sm text-foreground outline-none"
          style={{ lineHeight: LINE_HEIGHT + "px" }}
        />
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full border-none text-base transition-colors ${
            canSubmit
              ? "cursor-pointer bg-primary text-primary-foreground"
              : "cursor-default bg-muted text-muted-foreground"
          }`}
          aria-label="Submit"
        >
          &#8593;
        </button>
      </div>
    </div>
  );
}
