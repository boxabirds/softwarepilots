import { useState } from "react";

const REPLY_LABEL = "Reply";

interface TutorCardProps {
  content: string;
  loading?: boolean;
  onReply?: () => void;
}

export function TutorCard({ content, loading, onReply }: TutorCardProps) {
  const [tapped, setTapped] = useState(false);

  const handleCardClick = () => {
    if (onReply) setTapped((prev) => !prev);
  };

  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply?.();
  };

  return (
    <div
      className="group relative mr-10 mt-3 rounded-[10px] border border-border border-l-[3px] border-l-primary bg-muted p-4"
      onClick={handleCardClick}
      data-testid="tutor-card"
    >
      {loading ? (
        <div className="flex items-center gap-2 py-0.5">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-[13px] text-muted-foreground">Thinking...</span>
        </div>
      ) : (
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{content}</div>
      )}
      {onReply && !loading && (
        <button
          onClick={handleReplyClick}
          className={`absolute bottom-2 right-2 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-opacity hover:text-foreground ${
            tapped ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          data-testid="reply-button"
        >
          {REPLY_LABEL}
        </button>
      )}
    </div>
  );
}
