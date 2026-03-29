import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiClient } from "../lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBadge } from "@/components/ProgressBadge";
import { TrackSelector } from "@/components/TrackSelector";
import { EducationalGuidance } from "@/components/EducationalGuidance";
import { AIDisclaimer } from "@/components/AIDisclaimer";
import {
  getCurriculumProfiles,
} from "@softwarepilots/shared";
import type {
  CurriculumProfileSummary,
  LearnerProfile,
} from "@softwarepilots/shared";

/* ---- Level 0 interactive exercises (original POC) ---- */

interface ExerciseModule {
  number: number;
  title: string;
  description: string;
  status: "available" | "locked" | "completed";
  exerciseLink?: string;
  exerciseLabel?: string;
}

const LEVEL_0_EXERCISES: ExerciseModule[] = [
  {
    number: 1,
    title: "The New Landscape",
    description: "What changed, who builds software now, and why accountability matters.",
    status: "locked",
  },
  {
    number: 2,
    title: "The Machine Beneath",
    description: "Compilers, HTTP, databases, DevTools - the reality under the abstraction.",
    status: "available",
    exerciseLink: "/exercise/2/1",
    exerciseLabel: "Start: The Compiler Moment",
  },
  {
    number: 3,
    title: "The Probabilistic Machine",
    description: "Temperature, hallucination, cognitive surrender - why AI is confident and wrong.",
    status: "locked",
  },
  {
    number: 4,
    title: "Specification",
    description: "Writing specifications that constrain the machine's output.",
    status: "locked",
  },
  {
    number: 6,
    title: "Building with Agents",
    description: "Using AI agents to build from your specification.",
    status: "locked",
  },
  {
    number: 8,
    title: "Verification & Sustainable Practice",
    description: "Testing, acceptance, and maintaining human judgment over time.",
    status: "locked",
  },
];

/* ---- Shared types ---- */

interface SectionSummary {
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
  session_count?: number;
}

interface ModuleGroup {
  module_id: string;
  module_title: string;
  sections: SectionSummary[];
}

function groupByModule(sections: SectionSummary[]): ModuleGroup[] {
  const map = new Map<string, ModuleGroup>();
  for (const sec of sections) {
    let group = map.get(sec.module_id);
    if (!group) {
      group = {
        module_id: sec.module_id,
        module_title: sec.module_title,
        sections: [],
      };
      map.set(sec.module_id, group);
    }
    group.sections.push(sec);
  }
  return Array.from(map.values());
}

/* ---- Dashboard ---- */

const REFRESH_THROTTLE_MS = 30_000;

export function Dashboard() {
  const { learner, isLoading: authLoading } = useAuth();
  const authProfile = learner?.selected_profile ?? null;
  const navigate = useNavigate();

  // Local profile override allows in-place track switching without page reload
  const [profileOverride, setProfileOverride] = useState<string | null>(null);
  const selectedProfile = profileOverride ?? authProfile;

  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, SectionProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTrackPicker, setShowTrackPicker] = useState(false);
  const lastRefresh = useRef(0);

  const loadSections = useCallback(async (profile: string) => {
    setLoading(true);
    try {
      const [sections, progress] = await Promise.all([
        apiClient.get<SectionSummary[]>(`/api/curriculum/${profile}`),
        apiClient.get<SectionProgress[]>(`/api/curriculum/${profile}/progress`).catch(() => [] as SectionProgress[]),
      ]);
      setModules(groupByModule(sections));
      const map = new Map<string, SectionProgress>();
      for (const p of progress) {
        map.set(p.section_id, p);
      }
      setProgressMap(map);
      setError(null);
      lastRefresh.current = Date.now();
    } catch {
      setError("Failed to load sections");
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      loadSections(selectedProfile);
    }
  }, [selectedProfile, loadSections]);

  // Silent background progress refresh on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!selectedProfile) return;
      if (Date.now() - lastRefresh.current < REFRESH_THROTTLE_MS) return;

      apiClient
        .get<SectionProgress[]>(`/api/curriculum/${selectedProfile}/progress`)
        .then((progress) => {
          const map = new Map<string, SectionProgress>();
          for (const p of progress) {
            map.set(p.section_id, p);
          }
          setProgressMap(map);
          lastRefresh.current = Date.now();
        })
        .catch(() => {
          // Silently ignore - stale data is better than an error
        });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [selectedProfile]);

  async function handleTrackSelect(profile: string) {
    try {
      await apiClient.put("/api/auth/preferences", { selected_profile: profile });
      setProfileOverride(profile);
      setShowTrackPicker(false);
    } catch {
      setError("Failed to save track preference");
    }
  }

  // Wait for auth before deciding what to show
  if (authLoading) {
    return null;
  }

  // Onboarding interstitial - no profile selected
  if (!selectedProfile) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Choose your track
          </h1>
          <p
            className="mt-2 text-base"
            style={{ color: "var(--text-muted)" }}
          >
            Select the track that best matches your experience level.
          </p>
        </div>
        <TrackSelector
          selectedProfile={null}
          onSelect={handleTrackSelect}
        />
      </div>
    );
  }

  // Error state
  if (error && modules.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
        >
          <p className="mb-4 text-destructive">{error}</p>
          <Button variant="outline" onClick={() => loadSections(selectedProfile)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Track header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {selectedProfile.replace("level-", "Level ")}
          </h1>
          <button
            type="button"
            onClick={() => setShowTrackPicker(!showTrackPicker)}
            className="cursor-pointer text-sm underline"
            style={{ color: "var(--pilot-blue)" }}
            data-testid="change-track"
          >
            Change
          </button>
        </div>
        {(() => {
          const profiles = getCurriculumProfiles();
          const current = profiles.find((p) => p.profile === selectedProfile);
          return current?.starting_position ? (
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--text-muted)" }}
              data-testid="track-description"
            >
              {current.starting_position}
            </p>
          ) : null;
        })()}
      </div>

      {/* Inline track picker */}
      {showTrackPicker && (
        <div className="mb-6">
          <TrackSelector
            selectedProfile={selectedProfile}
            onSelect={handleTrackSelect}
          />
        </div>
      )}

      {/* Educational guidance */}
      <div className="mb-6">
        <EducationalGuidance />
      </div>

      {/* AI disclaimer */}
      <div className="mb-6">
        <AIDisclaimer />
      </div>

      {/* Module browser */}
      {loading ? (
        <p className="text-center" style={{ color: "var(--text-muted)" }}>
          Loading sections...
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Level 0 notice */}
          {selectedProfile === "level-0" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              UNDER CONSTRUCTION
            </div>
          )}

          {modules.map((mod) => (
            <ModuleTree
              key={mod.module_id}
              module={mod}
              profile={selectedProfile as LearnerProfile}
              progressMap={progressMap}
            />
          ))}

          {/* Level 0 interactive exercises */}
          {selectedProfile === "level-0" && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Interactive Exercises</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {LEVEL_0_EXERCISES.map((ex) => (
                  <ExerciseCard key={ex.number} {...ex} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Module tree ---- */

function ModuleTree({
  module: mod,
  profile,
  progressMap,
}: {
  module: ModuleGroup;
  profile: LearnerProfile;
  progressMap: Map<string, SectionProgress>;
}) {
  const hasProgress = progressMap.size > 0;

  // Compute aggregate claim coverage across sections in this module
  let totalClaims = 0;
  let demonstratedClaims = 0;
  for (const sec of mod.sections) {
    const progress = progressMap.get(sec.id);
    if (progress?.claim_progress) {
      totalClaims += progress.claim_progress.total;
      demonstratedClaims += progress.claim_progress.demonstrated;
    }
  }
  const hasClaimData = totalClaims > 0;
  const aggregatePercentage = totalClaims > 0
    ? Math.round((demonstratedClaims / totalClaims) * 100)
    : 0;

  return (
    <div>
      <h3
        className="mb-3 flex items-center gap-2 text-base font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        {mod.module_title}
        {hasProgress && hasClaimData && (
          <span className="font-normal normal-case tracking-normal" data-testid="module-claim-summary">
            ({demonstratedClaims}/{totalClaims} claims - {aggregatePercentage}%)
          </span>
        )}
        {hasProgress && !hasClaimData && (
          <span className="font-normal normal-case tracking-normal">
            ({mod.sections.filter((sec) => progressMap.get(sec.id)?.status === "completed").length}/{mod.sections.length})
          </span>
        )}
      </h3>
      <div className="flex flex-col gap-2">
        {mod.sections.map((sec) => (
          <SectionRow
            key={sec.id}
            section={sec}
            progress={progressMap.get(sec.id)}
            profile={profile}
          />
        ))}
      </div>
    </div>
  );
}

/* ---- Section row component ---- */

export function SectionRow({
  section: sec,
  progress,
  profile,
}: {
  section: SectionSummary;
  progress: SectionProgress | undefined;
  profile: LearnerProfile;
}) {
  const navigate = useNavigate();
  const status = progress?.status ?? "not_started";
  const detailPath = `/curriculum/${profile}/${sec.id}/detail`;

  const sessionCount = progress?.session_count;

  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-md border-b px-2 py-2.5 text-sm last:border-b-0 transition-colors hover:bg-[var(--bg-subtle)]"
      style={{ borderColor: "var(--border-light)" }}
      data-testid={`section-row-${sec.id}`}
      onClick={() => navigate(detailPath)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(detailPath);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Title */}
      <span
        className="min-w-0 flex-1 font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {sec.title}
      </span>

      {/* Progress indicator */}
      <span className="flex shrink-0 items-center gap-1.5">
        {status === "in_progress" && progress?.claim_progress && (
          <>
            <ProgressBadge status="in_progress" claimProgress={progress.claim_progress} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }} data-testid="claim-text">
              {progress.claim_progress.demonstrated}/{progress.claim_progress.total}
            </span>
          </>
        )}
        {status === "in_progress" && !progress?.claim_progress && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }} data-testid="in-progress-text">
            In progress
          </span>
        )}
        {status === "completed" && (
          <span className="text-xs font-medium text-green-600">Complete</span>
        )}
        {status === "needs_review" && (
          <span className="text-xs font-medium text-amber-600">Review</span>
        )}
      </span>

      {/* Session count */}
      {sessionCount != null && sessionCount > 0 && (
        <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }} data-testid="session-count">
          {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
        </span>
      )}

      {/* Right chevron */}
      <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </div>
  );
}

/* ---- Exercise card (Level 0) ---- */

function ExerciseCard({ number, title, description, status, exerciseLink, exerciseLabel }: ExerciseModule) {
  const isLocked = status === "locked";

  return (
    <Card className={isLocked ? "opacity-50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">
            Module {number}: {title}
          </CardTitle>
          {status === "completed" && (
            <Badge variant="default" className="bg-success text-white">Completed</Badge>
          )}
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {exerciseLink && !isLocked ? (
          <Link to={exerciseLink} className="inline-flex items-center justify-center rounded-lg px-2.5 h-8 text-sm font-medium transition-all" style={{ background: "var(--pilot-blue)", color: "var(--text-on-brand)" }}>
            {exerciseLabel || "Start Exercise"}
          </Link>
        ) : isLocked ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Complete previous modules to unlock
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
