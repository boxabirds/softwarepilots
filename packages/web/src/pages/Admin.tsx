import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../lib/api-client";

/* ---- Types ---- */

interface FeedbackEntry {
  id: number;
  profile: string;
  section_id: string;
  message_content: string;
  message_index: number;
  feedback_text: string;
  created_at: string;
  learner_name: string;
}

/* ---- Constants ---- */

const TRUNCATE_LENGTH = 80;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

/* ---- Helpers ---- */

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < SECONDS_PER_MINUTE) return "just now";
  if (diffSeconds < SECONDS_PER_HOUR) {
    const minutes = Math.floor(diffSeconds / SECONDS_PER_MINUTE);
    return `${minutes}m ago`;
  }
  if (diffSeconds < SECONDS_PER_DAY) {
    const hours = Math.floor(diffSeconds / SECONDS_PER_HOUR);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffSeconds / SECONDS_PER_DAY);
  return `${days}d ago`;
}

/* ---- Component ---- */

export function Admin() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<FeedbackEntry[]>("/api/admin/feedback");
      setFeedback(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this feedback entry?")) return;
    try {
      await apiClient.delete(`/api/admin/feedback/${id}`);
      await fetchFeedback();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete feedback");
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 16,
        }}
      >
        Admin
      </h1>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          borderBottom: "1px solid var(--border-light)",
          paddingBottom: 12,
        }}
      >
        <button
          style={{
            padding: "6px 16px",
            borderRadius: 9999,
            fontSize: 14,
            fontWeight: 600,
            background: "var(--pilot-blue)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
          data-testid="tab-feedback"
        >
          Feedback
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: 16,
            marginBottom: 16,
            borderRadius: 8,
            background: "var(--bg-muted)",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          data-testid="error-state"
        >
          <span>{error}</span>
          <button
            onClick={fetchFeedback}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 13,
              background: "var(--pilot-blue)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <p style={{ color: "var(--text-muted)" }}>Loading feedback...</p>
      )}

      {/* Empty state */}
      {!loading && !error && feedback.length === 0 && (
        <p style={{ color: "var(--text-muted)" }} data-testid="empty-state">
          No feedback has been submitted yet
        </p>
      )}

      {/* Table */}
      {!loading && !error && feedback.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
          data-testid="feedback-table"
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid var(--border-light)",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>
                Section
              </th>
              <th style={{ padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>
                Message
              </th>
              <th style={{ padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>
                Feedback
              </th>
              <th style={{ padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>
                From
              </th>
              <th style={{ padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>
                When
              </th>
              <th style={{ padding: "8px 12px" }} />
            </tr>
          </thead>
          <tbody>
            {feedback.map((entry) => (
              <FeedbackRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => toggleExpand(entry.id)}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FeedbackRow({
  entry,
  expanded,
  onToggle,
  onDelete,
}: {
  entry: FeedbackEntry;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: "1px solid var(--border-light)",
          cursor: "pointer",
          background: expanded ? "var(--bg-muted)" : "transparent",
        }}
        data-testid={`feedback-row-${entry.id}`}
      >
        <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>
          {entry.profile}/{entry.section_id}
        </td>
        <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>
          {truncate(entry.message_content, TRUNCATE_LENGTH)}
        </td>
        <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>
          {truncate(entry.feedback_text, TRUNCATE_LENGTH)}
        </td>
        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
          {entry.learner_name}
        </td>
        <td style={{ padding: "10px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {relativeTime(entry.created_at)}
        </td>
        <td style={{ padding: "10px 12px" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              background: "transparent",
              color: "var(--text-muted)",
              border: "1px solid var(--border-light)",
              cursor: "pointer",
            }}
            data-testid={`delete-btn-${entry.id}`}
          >
            Delete
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: "var(--bg-muted)" }}>
          <td colSpan={6} style={{ padding: "12px 24px" }}>
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: "var(--text-muted)", fontSize: 12 }}>
                Full Message
              </strong>
              <p style={{ color: "var(--text-primary)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                {entry.message_content}
              </p>
            </div>
            <div>
              <strong style={{ color: "var(--text-muted)", fontSize: 12 }}>
                Full Feedback
              </strong>
              <p style={{ color: "var(--text-primary)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                {entry.feedback_text}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
