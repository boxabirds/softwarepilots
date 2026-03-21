import { useState } from "react";

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
      className="group relative mr-10 mt-3 rounded-xl p-4"
      style={{
        background: "#F4F6FD",
        borderLeft: "3px solid #1A4FD1",
      }}
      onClick={handleCardClick}
      data-testid="tutor-card"
    >
      {loading ? (
        <div className="flex items-center gap-2 py-0.5">
          <div
            className="size-4 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "#1A4FD1", borderTopColor: "transparent" }}
          />
          <span className="text-[13px]" style={{ color: "#7A8BA8" }}>Thinking...</span>
        </div>
      ) : (
        <div
          className="whitespace-pre-wrap text-[13px] leading-relaxed"
          style={{ color: "#2A3654" }}
        >
          {content}
        </div>
      )}
      {onReply && !loading && (
        <button
          onClick={handleReplyClick}
          className={`absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-[11px] font-medium transition-opacity ${
            tapped ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{ color: "#1A4FD1", background: "rgba(26, 79, 209, 0.08)" }}
          data-testid="reply-button"
        >
          Reply
        </button>
      )}
    </div>
  );
}
