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
      return;
    }

    setExpanded(profile);
    setLoadingSections(true);
    try {
      const sections = await apiClient.get<SectionSummary[]>(
        `/api/curriculum/${profile}`,
      );
      setModules(groupByModule(sections));
      setError(null);
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
      <CardContent>
        <Badge variant="secondary">
          {profile.section_count} sections
        </Badge>
      </CardContent>
    </Card>
  );
}

function ModuleTree({
  module: mod,
  profile,
}: {
  module: ModuleGroup;
  profile: LearnerProfile;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {mod.module_title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {mod.sections.map((sec) => (
            <li key={sec.id}>
              <Link
                to={`/curriculum/${profile}/${sec.id}`}
                className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                {sec.title}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
