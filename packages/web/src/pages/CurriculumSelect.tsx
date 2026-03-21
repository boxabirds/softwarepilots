import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

/** Section data returned by GET /api/curriculum/:profile (no markdown) */
interface SectionSummary {
  id: string;
  module_id: string;
  module_title: string;
  title: string;
  key_intuition: string;
}

/** Progress data returned by GET /api/curriculum/:profile/progress */
interface SectionProgress {
  section_id: string;
  status: "not_started" | "in_progress" | "completed";
  understanding_level?: string;
  updated_at: string;
}

/** Sections grouped by module for display */
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

export function CurriculumSelect() {
  const [profiles, setProfiles] = useState<CurriculumProfileSummary[]>([]);
  const [expanded, setExpanded] = useState<LearnerProfile | null>(null);
  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [progressMap, setProgressMap] = useState<
    Map<string, SectionProgress>
  >(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    apiClient
      .get<CurriculumProfileSummary[]>("/api/curriculum")
      .then(setProfiles)
      .catch(() => setError("Failed to load curriculum tracks"));
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
      const sections = await apiClient.get<SectionSummary[]>(
        `/api/curriculum/${profile}`,
      );
      setModules(groupByModule(sections));
      setError(null);

      // Fetch progress separately - failure is non-fatal
      try {
        const progress = await apiClient.get<SectionProgress[]>(
          `/api/curriculum/${profile}/progress`,
        );
        const map = new Map<string, SectionProgress>();
        for (const p of progress) {
          map.set(p.section_id, p);
        }
        setProgressMap(map);
      } catch {
        // Progress fetch failed - sections still display without badges
      }
    } catch {
      setError(`Failed to load sections for ${profile}`);
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
      .catch(() => setError("Failed to load curriculum tracks"));
  }

  if (error && profiles.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Choose Your Track</h1>
        </header>
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
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Choose Your Track</h1>
        <Link
          to="/dashboard"
          className="text-sm text-muted-foreground hover:underline"
        >
          Back to Dashboard
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {profiles.map((profile) => (
          <TrackCard
            key={profile.profile}
            profile={profile}
            isExpanded={expanded === profile.profile}
            onToggle={() => handleToggle(profile.profile)}
          />
        ))}
      </div>

      {expanded && (
        <div className="mt-6">
          {loadingSections ? (
            <p className="text-center text-muted-foreground">
              Loading sections...
            </p>
          ) : error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center"
            >
              <p className="text-destructive">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {modules.map((mod) => (
                <ModuleTree
                  key={mod.module_id}
                  module={mod}
                  profile={expanded}
                  progressMap={progressMap}
                />
              ))}
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
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md ${isExpanded ? "ring-2 ring-primary" : ""}`}
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
      <CardHeader>
        <CardTitle>{profile.title}</CardTitle>
        <CardDescription>{profile.starting_position}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Badge variant="secondary">
          {profile.section_count} sections
        </Badge>
        <Link
          to={`/curriculum/${profile.profile}/progress`}
          className="text-xs text-primary underline hover:no-underline"
          onClick={(e) => e.stopPropagation()}
        >
          View Progress
        </Link>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {mod.module_title}
          {hasProgress && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {completedCount} of {totalCount} completed
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {mod.sections.map((sec) => {
            const progress = progressMap.get(sec.id);
            return (
              <li key={sec.id}>
                <Link
                  to={`/curriculum/${profile}/${sec.id}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  {progress && (
                    <ProgressBadge
                      status={progress.status}
                      understandingLevel={progress.understanding_level}
                    />
                  )}
                  {sec.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
