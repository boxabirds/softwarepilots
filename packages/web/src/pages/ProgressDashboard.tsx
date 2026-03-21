import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ---- API response types ---- */

interface ConceptDetail {
  level: string;
  review_count: number;
}

interface SectionProgress {
  section_id: string;
  title: string;
  status: string;
  understanding_level?: string;
  concepts: Record<string, ConceptDetail>;
}

interface DueConcept {
  concept: string;
  section_id: string;
  days_overdue: number;
}

interface ProgressStats {
  completed: number;
  in_progress: number;
  paused: number;
  not_started: number;
  total: number;
}

interface ProgressSummaryResponse {
  overall_narrative: string | null;
  sections: SectionProgress[];
  stats: ProgressStats;
  concepts_due_for_review: DueConcept[];
}

/* ---- Helpers ---- */

/** Group sections by module (derive module from section_id prefix) */
interface ModuleGroup {
  module_prefix: string;
  sections: SectionProgress[];
}

function groupByModule(sections: SectionProgress[]): ModuleGroup[] {
  const map = new Map<string, ModuleGroup>();
  for (const sec of sections) {
    const prefix = sec.section_id.split(".")[0];
    let group = map.get(prefix);
    if (!group) {
      group = { module_prefix: prefix, sections: [] };
      map.set(prefix, group);
    }
    group.sections.push(sec);
  }
  return Array.from(map.values());
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "paused":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In Progress";
    case "paused":
      return "Paused";
    default:
      return "Not Started";
  }
}

/* ---- Component ---- */

export function ProgressDashboard() {
  const { profile } = useParams<{ profile: string }>();
  const [data, setData] = useState<ProgressSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set()
  );

  function fetchSummary() {
    setLoading(true);
    setError(null);
    apiClient
      .get<ProgressSummaryResponse>(
        `/api/curriculum/${profile}/progress/summary`
      )
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load progress summary");
        setLoading(false);
      });
  }

  useEffect(() => {
    if (profile) fetchSummary();
  }, [profile]);

  function toggleModule(prefix: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading progress...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Progress Dashboard</h1>
        </header>
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
        >
          <p className="mb-4 text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchSummary}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overall_narrative, sections, stats, concepts_due_for_review } = data;
  const modules = groupByModule(sections);
  const hasProgress = stats.completed > 0 || stats.in_progress > 0;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progress Dashboard</h1>
        <Link
          to="/curriculum"
          className="text-sm text-muted-foreground hover:underline"
        >
          Back to Curriculum
        </Link>
      </header>

      {/* Overall narrative card */}
      <Card className="mb-6" data-testid="narrative-card">
        <CardContent className="pt-6">
          {hasProgress && overall_narrative ? (
            <p className="text-base leading-relaxed">{overall_narrative}</p>
          ) : (
            <p className="text-muted-foreground">
              Start your first section to see your progress narrative here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div
        className="mb-6 flex flex-wrap gap-3"
        data-testid="stats-bar"
      >
        <Badge className="bg-green-100 text-green-800">
          {stats.completed} completed
        </Badge>
        <Badge className="bg-blue-100 text-blue-800">
          {stats.in_progress} in progress
        </Badge>
        <Badge className="bg-gray-100 text-gray-600">
          {stats.not_started} not started
        </Badge>
        {concepts_due_for_review.length > 0 && (
          <Badge className="bg-orange-100 text-orange-800">
            {concepts_due_for_review.length} concepts due for review
          </Badge>
        )}
      </div>

      {/* Module sections */}
      <div className="flex flex-col gap-4">
        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod.module_prefix);
          const completedCount = mod.sections.filter(
            (s) => s.status === "completed"
          ).length;

          return (
            <Card key={mod.module_prefix} data-testid="module-card">
              <CardHeader
                className="cursor-pointer pb-2"
                onClick={() => toggleModule(mod.module_prefix)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleModule(mod.module_prefix);
                  }
                }}
              >
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  <span>Module {mod.module_prefix}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {completedCount} of {mod.sections.length} completed
                  </span>
                </CardTitle>
              </CardHeader>

              {isExpanded && (
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {mod.sections.map((sec) => (
                      <li
                        key={sec.section_id}
                        className="rounded-md border p-3"
                        data-testid="section-card"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/curriculum/${profile}/${sec.section_id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {sec.title}
                          </Link>
                          <Badge
                            className={statusBadgeClass(sec.status)}
                          >
                            {statusLabel(sec.status)}
                          </Badge>
                        </div>
                        {sec.understanding_level && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Understanding: {sec.understanding_level}
                          </p>
                        )}
                        {Object.keys(sec.concepts).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(sec.concepts).map(
                              ([name, detail]) => (
                                <span
                                  key={name}
                                  className={`rounded-full px-2 py-0.5 text-xs ${conceptLevelClass(detail.level)}`}
                                >
                                  {name}
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function conceptLevelClass(level: string): string {
  switch (level) {
    case "emerging":
      return "bg-yellow-100 text-yellow-800";
    case "developing":
      return "bg-blue-100 text-blue-800";
    case "solid":
      return "bg-green-100 text-green-800";
    case "strong":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
