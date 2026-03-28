export interface SessionSummary {
  id: string;
  created_at: string;
  archived_at?: string | null;
  summary?: string | null;
  message_count: number;
  status: string;
}

interface SessionHistoryProps {
  sessions: SessionSummary[];
}

const SESSION_LABEL_PREFIX = "Session";

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const SUMMARY_SNIPPET_LENGTH = 80;

export function SessionHistory({ sessions }: SessionHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div
        className="rounded-lg px-4 py-6 text-center text-sm"
        style={{ color: "var(--text-muted)", background: "var(--bg-subtle)" }}
        data-testid="session-history-empty"
      >
        No sessions yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-testid="session-history">
      {sessions.map((session, index) => {
        const isActive = !session.archived_at;
        const sessionNumber = sessions.length - index;
        const snippet =
          session.summary && session.summary.length > SUMMARY_SNIPPET_LENGTH
            ? session.summary.slice(0, SUMMARY_SNIPPET_LENGTH) + "..."
            : session.summary;

        return (
          <div
            key={session.id}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm"
            style={{
              background: isActive ? "rgba(var(--pilot-blue-rgb, 59, 130, 246), 0.08)" : "transparent",
              borderLeft: isActive ? "3px solid var(--pilot-blue)" : "3px solid transparent",
            }}
            data-testid={`session-row-${session.id}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {SESSION_LABEL_PREFIX} {sessionNumber}
                </span>
                {isActive && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "var(--pilot-blue)", color: "var(--text-on-brand)" }}
                  >
                    Active
                  </span>
                )}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {relativeDate(session.created_at)}
                </span>
              </div>
              {snippet && (
                <p
                  className="mt-0.5 truncate text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {snippet}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
              {session.message_count} msgs
            </span>
          </div>
        );
      })}
    </div>
  );
}
