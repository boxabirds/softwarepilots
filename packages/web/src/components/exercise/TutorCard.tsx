import { useState, useRef, useEffect } from "react";

/** Lightweight inline markdown: **bold**, *italic*, `code`. No dependencies. */
function formatInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code` in order of specificity
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(<code key={key++} className="rounded bg-black/10 px-1 py-0.5 text-[0.7rem]">{match[4]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface TutorCardProps {
  content: string;
  loading?: boolean;
  variant?: "default" | "instruction";
  onReply?: () => void;
  onFeedback?: () => void;
}

export function TutorCard({ content, loading, variant = "default", onReply, onFeedback }: TutorCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className="group relative mr-10 mt-3 rounded-xl p-4"
      style={{
        background: variant === "instruction" ? "var(--status-warning-bg)" : "var(--tutor-card-bg)",
        borderLeft: `3px solid ${variant === "instruction" ? "var(--status-warning)" : "var(--pilot-blue)"}`,
      }}
      data-testid={variant === "instruction" ? "instruction-card" : "tutor-card"}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-0.5">
          <div
            className="size-4 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--pilot-blue)", borderTopColor: "transparent" }}
          />
          <span className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>Thinking...</span>
        </div>
      ) : (
        <div
          className="whitespace-pre-wrap text-[0.75rem] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {variant === "instruction" && <span className="mr-1.5" aria-hidden="true">&#128161;</span>}
          {formatInlineMarkdown(content)}
        </div>
      )}

      {/* Three-dot menu - shows on hover (desktop) or always subtle (mobile) */}
      {(onReply || onFeedback) && !loading && (
        <div className="absolute top-2 right-2" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex size-6 items-center justify-center rounded-md text-sm opacity-0 transition-opacity group-hover:opacity-100"
            style={{
              color: "var(--text-muted)",
              background: menuOpen ? "var(--bg-muted)" : "transparent",
              /* Always visible on touch devices via media query below */
            }}
            data-testid="message-menu-trigger"
            aria-label="Message options"
          >
            &middot;&middot;&middot;
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full z-10 mt-1 min-w-[100px] rounded-lg py-1 shadow-lg"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-light)",
              }}
            >
              {onReply && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onReply();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ color: "var(--text-primary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  data-testid="reply-button"
                >
                  Reply
                </button>
              )}
              {onFeedback && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onFeedback();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ color: "var(--text-primary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  data-testid="feedback-button"
                >
                  Feedback
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Make menu trigger visible on touch devices */}
      <style>{`
        @media (hover: none) {
          [data-testid="message-menu-trigger"] {
            opacity: 0.5 !important;
          }
        }
      `}</style>
    </div>
  );
}
