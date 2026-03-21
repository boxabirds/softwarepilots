import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
import type {
  CurriculumProfileSummary,
  LearnerProfile,
} from "@softwarepilots/shared";

interface SectionSummary {
  id: string;
  module_id: string;
  module_title: string;
  title: string;
  key_intuition: string;
}

interface SectionProgress {
  section_id: string;
  status: "not_started" | "in_progress" | "completed";
  understanding_level?: string;
  updated_at: string;
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

export function Dashboard() {
  const [profiles, setProfiles] = useState<CurriculumProfileSummary[]>([]);
  const [expanded, setExpanded] = useState<LearnerProfile | null>(null);
  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, SectionProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    apiClient
      .get<CurriculumProfileSummary[]>("/api/curriculum")
      .then(setProfiles)
      .catch(() => setError("Failed to load tracks"));
  }, []);

  async function handleToggle(profile: LearnerProfile) {
    if (expanded === profile) {
      setExpanded(null);
      setModules([]);
      setProgressMap(new Map());
      return;
    }

    setExpanded(profile);
    setLoadingSections(true);
    setProgressMap(new Map());
    try {
      const [sections, progress] = await Promise.all([
        apiClient.get<SectionSummary[]>(`/api/curriculum/${profile}`),
        apiClient.get<SectionProgress[]>(`/api/curriculum/${profile}/progress`).catch(() => [] as SectionProgress[]),
      ]);

      setModules(groupByModule(sections));
      setError(null);

      const map = new Map<string, SectionProgress>();
      for (const p of progress) {
        map.set(p.section_id, p);
      }
      setProgressMap(map);
    } catch {
      setError(`Failed to load sections`);
      setModules([]);
    } finally {
      setLoadingSections(false);
    }
  }

  function handleRetry() {
    setError(null);
    apiClient
      .get<CurriculumProfileSummary[]>("/api/curriculum")
      .then(setProfiles)
      .catch(() => setError("Failed to load tracks"));
  }

  if (error && profiles.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
        >
          <p className="mb-4 text-destructive">{error}</p>
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Track cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {profiles.map((profile) => (
          <TrackCard
            key={profile.profile}
            profile={profile}
            isExpanded={expanded === profile.profile}
            onToggle={() => handleToggle(profile.profile)}
          />
        ))}
      </div>

      {/* Expanded section area */}
      {expanded && (
        <div className="mt-6">
          {loadingSections ? (
            <p className="text-center text-[var(--text-muted)]">Loading sections...</p>
          ) : error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center"
            >
              <p className="text-destructive">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Level 0 notice */}
              {expanded === "level-0" && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  UNDER CONSTRUCTION
                </div>
              )}

              {modules.map((mod) => (
                <ModuleTree
                  key={mod.module_id}
                  module={mod}
                  profile={expanded}
                  progressMap={progressMap}
                />
              ))}

              {/* Level 0 interactive exercises */}
              {expanded === "level-0" && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7A8BA8" }}>Interactive Exercises</h3>
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
      )}
    </div>
  );
}

function TrackCard({
  profile,
  isExpanded,
  onToggle,
}: {
  profile: CurriculumProfileSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="cursor-pointer rounded-xl p-5 transition-all"
      style={isExpanded ? {
        background: "linear-gradient(135deg, #1A4FD1, #0F2C7E)",
        color: "white",
        boxShadow: "0 8px 24px rgba(26, 79, 209, 0.3)",
      } : {
        background: "#FAFBFE",
        border: "1px solid #D1DBF5",
      }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <h2
        className="text-xl font-bold"
        style={{ color: isExpanded ? "#ffffff" : "#0D1526" }}
      >
        {profile.title}
      </h2>
      <p
        className="mt-2 line-clamp-2 text-sm"
        style={{ color: isExpanded ? "rgba(255,255,255,0.75)" : "#4A5A7A" }}
      >
        {profile.starting_position}
      </p>
      <div className="mt-4">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={isExpanded ? {
            background: "rgba(255,255,255,0.2)",
            color: "#ffffff",
          } : {
            background: "#E8EDFA",
            color: "#13389E",
          }}
        >
          {profile.section_count} sections
        </span>
      </div>
    </div>
  );
}

function ModuleTree({
  module: mod,
  profile,
  progressMap,
}: {
  module: ModuleGroup;
  profile: LearnerProfile;
  progressMap: Map<string, SectionProgress>;
}) {
  const completedCount = mod.sections.filter(
    (sec) => progressMap.get(sec.id)?.status === "completed",
  ).length;
  const totalCount = mod.sections.length;
  const hasProgress = progressMap.size > 0;

  return (
    <div>
      <h3
        className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "#7A8BA8" }}
      >
        {mod.module_title}
        {hasProgress && (
          <span className="font-normal normal-case tracking-normal">
            ({completedCount}/{totalCount})
          </span>
        )}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mod.sections.map((sec) => {
          const progress = progressMap.get(sec.id);
          return (
            <Link
              key={sec.id}
              to={`/curriculum/${profile}/${sec.id}`}
              className="flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm no-underline transition-all hover:shadow-sm"
              style={{
                background: "#F4F6FD",
                border: "1px solid #E8EDFA",
                color: "#2A3654",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#00AAFF";
                e.currentTarget.style.background = "#FAFBFE";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E8EDFA";
                e.currentTarget.style.background = "#F4F6FD";
              }}
            >
              {progress ? (
                <ProgressBadge
                  status={progress.status}
                  understandingLevel={progress.understanding_level}
                />
              ) : null}
              <span>{sec.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

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
          <Link to={exerciseLink} className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80">
            {exerciseLabel || "Start Exercise"}
          </Link>
        ) : isLocked ? (
          <p className="text-xs text-muted-foreground">
            Complete previous modules to unlock
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
