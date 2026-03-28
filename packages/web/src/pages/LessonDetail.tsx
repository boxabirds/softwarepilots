import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../lib/api-client";
import { ProgressBadge } from "../components/ProgressBadge";
import { SessionHistory } from "../components/SessionHistory";
import type { SessionSummary } from "../components/SessionHistory";
import { AIDisclaimer } from "../components/AIDisclaimer";
import { Button } from "@/components/ui/button";

interface SectionMeta {
  id: string;
  module_id: string;
  module_title: string;
  title: string;
  key_intuition: string;
}

interface ClaimProgressData {
  demonstrated: number;
  total: number;
  percentage: number;
  missing?: string[];
}

interface SectionProgress {
  section_id: string;
  status: "not_started" | "in_progress" | "completed" | "needs_review";
  understanding_level?: string;
  claim_progress?: ClaimProgressData;
  updated_at: string;
}

export function LessonDetail() {
  const { profile, sectionId } = useParams<{ profile: string; sectionId: string }>();
  const navigate = useNavigate();

  const [section, setSection] = useState<SectionMeta | null>(null);
  const [progress, setProgress] = useState<SectionProgress | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile || !sectionId) return;
    setLoading(true);
    try {
      const [sectionData, progressData, sessionsData] = await Promise.all([
        apiClient.get<SectionMeta>(`/api/curriculum/${profile}/${sectionId}`),
        apiClient
          .get<SectionProgress[]>(`/api/curriculum/${profile}/progress`)
          .then((all) => all.find((p) => p.section_id === sectionId) ?? null)
          .catch(() => null),
        apiClient
          .get<SessionSummary[]>(`/api/curriculum/${profile}/${sectionId}/sessions`)
          .catch(() => [] as SessionSummary[]),
      ]);
      setSection(sectionData);
      setProgress(progressData);
      setSessions(sessionsData);
      setError(null);
    } catch {
      setError("Failed to load lesson details");
    } finally {
      setLoading(false);
    }
  }, [profile, sectionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh on window focus
  useEffect(() => {
    window.addEventListener("focus", fetchData);
    return () => window.removeEventListener("focus", fetchData);
  }, [fetchData]);

  const sessionPath = `/curriculum/${profile}/${sectionId}`;
  const status = progress?.status ?? "not_started";
  const hasActiveSession = sessions.some((s) => !s.archived_at);
  const hasSessions = sessions.length > 0;

  async function handleStartNew() {
    if (!profile || !sectionId) return;
    try {
      await apiClient.post(`/api/curriculum/${profile}/${sectionId}/archive`, {});
    } catch {
      // Archive may fail if no active session - continue anyway
    }
    navigate(sessionPath);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-center" style={{ color: "var(--text-muted)" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (error || !section) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
        >
          <p className="mb-4 text-destructive">{error ?? "Lesson not found"}</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6" data-testid="lesson-detail">
      <div className="grid gap-8 md:grid-cols-[1fr_300px]">
        {/* Left column - lesson info */}
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {section.title}
            </h1>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {section.key_intuition}
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <ProgressBadge
              status={status}
              claimProgress={progress?.claim_progress}
            />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {status === "not_started" && "Not started"}
              {status === "in_progress" &&
                (progress?.claim_progress
                  ? `${progress.claim_progress.demonstrated}/${progress.claim_progress.total} concepts`
                  : "In progress")}
              {status === "completed" && "Completed"}
              {status === "needs_review" && "Due for review"}
            </span>
          </div>

          {/* Session history */}
          <div>
            <h2
              className="mb-3 text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Sessions
            </h2>
            <SessionHistory sessions={sessions} />
          </div>
        </div>

        {/* Right column - actions */}
        <div className="flex flex-col gap-4">
          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {hasActiveSession && (
              <Button
                onClick={() => navigate(sessionPath)}
                className="w-full"
                style={{ background: "var(--pilot-blue)", color: "var(--text-on-brand)" }}
                data-testid="continue-session"
              >
                Continue session
              </Button>
            )}

            {!hasSessions && (
              <Button
                onClick={() => navigate(sessionPath)}
                className="w-full"
                style={{ background: "var(--pilot-blue)", color: "var(--text-on-brand)" }}
                data-testid="begin-lesson"
              >
                Begin lesson
              </Button>
            )}

            {hasSessions && (
              <Button
                variant="outline"
                onClick={handleStartNew}
                className="w-full"
                data-testid="start-new-session"
              >
                Start new session
              </Button>
            )}

            {status === "completed" && (
              <Button
                variant="outline"
                onClick={handleStartNew}
                className="w-full"
                data-testid="revisit-lesson"
              >
                Revisit
              </Button>
            )}
          </div>

          {/* AI Disclaimer */}
          <div className="mt-4">
            <AIDisclaimer />
          </div>
        </div>
      </div>
    </div>
  );
}
