import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";

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
          className="prose prose-sm max-w-none text-[0.75rem] leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0"
          style={{ color: "var(--text-secondary)" }}
        >
          {variant === "instruction" && <span className="mr-1.5" aria-hidden="true">&#128161;</span>}
          <Markdown>{content}</Markdown>
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
