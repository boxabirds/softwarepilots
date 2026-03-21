interface TutorCardProps {
  content: string;
  loading?: boolean;
  onReply?: () => void;
}

export function TutorCard({ content, loading, onReply }: TutorCardProps) {
  return (
    <div
      className="mr-10 mt-3 rounded-xl p-4"
      style={{
        background: "var(--tutor-card-bg)",
        borderLeft: "3px solid var(--pilot-blue)",
      }}
      data-testid="tutor-card"
    >
      {loading ? (
        <div className="flex items-center gap-2 py-0.5">
          <div
            className="size-4 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--pilot-blue)", borderTopColor: "transparent" }}
          />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Thinking...</span>
        </div>
      ) : (
        <div
          className="whitespace-pre-wrap text-[13px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {content}
        </div>
      )}
      {onReply && !loading && (
        <button
          onClick={(e) => { e.stopPropagation(); onReply?.(); }}
          className="mt-2 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors"
          style={{
            color: "var(--text-on-brand)",
            background: "var(--pilot-blue)",
          }}
          data-testid="reply-button"
        >
          Reply
        </button>
      )}
    </div>
  );
}
