import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { apiClient } from "../lib/api-client";
import { ProgressBadge } from "../components/ProgressBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ---- Types ---- */

interface Section {
  id: string;
  title: string;
}

interface Module {
  id: string;
  title: string;
  sections: Section[];
}

interface Profile {
  id: string;
  title: string;
  modules: Module[];
}

interface ProgressEntry {
  section_id: string;
  status: "not_started" | "in_progress" | "completed";
  understanding_level?: string;
  updated_at: string;
}

type ProgressMap = Record<string, ProgressEntry>;

/* ---- Placeholder data ---- */
// In a real app these would come from an API; for now hardcoded
const PROFILES: Profile[] = [
  {
    id: "foundations",
    title: "Foundations",
    modules: [
      {
        id: "mod-1",
        title: "The New Landscape",
        sections: [
          { id: "1.1", title: "What Changed" },
          { id: "1.2", title: "Who Builds Software Now" },
          { id: "1.3", title: "Why Accountability Matters" },
        ],
      },
      {
        id: "mod-2",
        title: "The Machine Beneath",
        sections: [
          { id: "2.1", title: "The Compiler Moment" },
          { id: "2.2", title: "HTTP & Databases" },
          { id: "2.3", title: "DevTools" },
        ],
      },
    ],
  },
];

/* ---- Component ---- */

export function CurriculumSelect() {
  const { learner } = useAuth();
  const [expandedProfile, setExpandedProfile] = useState<string | null>(
    PROFILES[0]?.id ?? null
  );
  const [progressMap, setProgressMap] = useState<ProgressMap>({});

  const fetchProgress = useCallback(
    async (profileId: string) => {
      if (!learner) return;
      try {
        const entries = await apiClient.get<ProgressEntry[]>(
          `/api/curriculum/${profileId}/progress`
        );
        const map: ProgressMap = {};
        for (const entry of entries) {
          map[entry.section_id] = entry;
        }
        setProgressMap(map);
      } catch {
        setProgressMap({});
      }
    },
    [learner]
  );

  useEffect(() => {
    if (expandedProfile) {
      fetchProgress(expandedProfile);
    }
  }, [expandedProfile, fetchProgress]);

  const toggleProfile = (profileId: string) => {
    setExpandedProfile((prev) => (prev === profileId ? null : profileId));
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Curriculum</h1>
      </header>

      <div className="flex flex-col gap-4">
        {PROFILES.map((profile) => (
          <Card key={profile.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleProfile(profile.id)}
            >
              <CardTitle className="text-lg">{profile.title}</CardTitle>
            </CardHeader>
            {expandedProfile === profile.id && (
              <CardContent>
                <div className="flex flex-col gap-4">
                  {profile.modules.map((mod) => {
                    const completedCount = mod.sections.filter(
                      (s) => progressMap[s.id]?.status === "completed"
                    ).length;
                    const totalCount = mod.sections.length;

                    return (
                      <div key={mod.id}>
                        <h3 className="mb-2 font-semibold">
                          {mod.title}{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            {completedCount} of {totalCount} completed
                          </span>
                        </h3>
                        <ul className="flex flex-col gap-1 pl-4">
                          {mod.sections.map((section) => {
                            const progress = progressMap[section.id];
                            const status = progress?.status ?? "not_started";
                            return (
                              <li
                                key={section.id}
                                className="flex items-center gap-2"
                              >
                                <ProgressBadge
                                  status={status}
                                  understandingLevel={
                                    progress?.understanding_level
                                  }
                                />
                                <span className="text-sm">{section.title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
