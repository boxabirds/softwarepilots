import { useState, useEffect, useMemo, useCallback } from "react";
import { getCurriculumSections } from "@softwarepilots/shared";
import { cn } from "@/lib/utils";
import { ProgressBadge, type ClaimProgressData } from "@/components/ProgressBadge";

/* ---- Constants ---- */

const PERCENTAGE_SCALE = 100;
const CHEVRON_ROTATE_OPEN = "rotate-90";

/* ---- Types ---- */

interface ProgressSection {
  section_id: string;
  status: string;
  updated_at: string;
  understanding_level?: string;
  claim_progress?: {
    demonstrated: number;
    total: number;
    percentage: number;
    missing: string[];
  };
}

interface ProfileProgress {
  profile: string;
  title: string;
  sections: ProgressSection[];
}

interface UserProgressResponse {
  learner: {
    id: string;
    display_name: string | null;
    enrolled_at: string | null;
  };
  profiles: ProfileProgress[];
}

interface ModuleNode {
  module_id: string;
  module_title: string;
  sections: SectionNode[];
  aggregatePercentage: number;
  aggregateDemonstrated: number;
  aggregateTotal: number;
}

interface SectionNode {
  section_id: string;
  section_title: string;
  status: string;
  claimProgress?: ClaimProgressData;
}

export interface CurriculumTreeProps {
  selectedUserId: string | null;
  selectedProfile: string | null;
  selectedSection: string | null;
  onSelectSection: (profile: string, sectionId: string) => void;
  adminFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
}

/* ---- Helpers ---- */

function buildModuleTree(
  profileProgress: ProfileProgress
): ModuleNode[] {
  /* Get the curriculum section metadata for module grouping */
  let sectionMetas: ReturnType<typeof getCurriculumSections>;
  try {
    sectionMetas = getCurriculumSections(profileProgress.profile);
  } catch {
    /* Unknown profile - return flat list with derived module IDs */
    return buildModuleTreeFromSectionIds(profileProgress);
  }

  /* Build a lookup: section_id -> meta */
  const metaMap = new Map(sectionMetas.map((s) => [s.id, s]));

  /* Group progress sections by module */
  const moduleMap = new Map<string, ModuleNode>();

  for (const section of profileProgress.sections) {
    const meta = metaMap.get(section.section_id);
    const moduleId = meta?.module_id ?? deriveModuleId(section.section_id);
    const moduleTitle = meta?.module_title ?? `Module ${moduleId}`;
    const sectionTitle = meta?.title ?? `Section ${section.section_id}`;

    if (!moduleMap.has(moduleId)) {
      moduleMap.set(moduleId, {
        module_id: moduleId,
        module_title: moduleTitle,
        sections: [],
        aggregatePercentage: 0,
        aggregateDemonstrated: 0,
        aggregateTotal: 0,
      });
    }

    const mod = moduleMap.get(moduleId)!;
    mod.sections.push({
      section_id: section.section_id,
      section_title: sectionTitle,
      status: section.status,
      claimProgress: section.claim_progress
        ? {
            demonstrated: section.claim_progress.demonstrated,
            total: section.claim_progress.total,
            percentage: section.claim_progress.percentage,
          }
        : undefined,
    });

    if (section.claim_progress) {
      mod.aggregateDemonstrated += section.claim_progress.demonstrated;
      mod.aggregateTotal += section.claim_progress.total;
    }
  }

  /* Compute aggregate percentages */
  for (const mod of moduleMap.values()) {
    mod.aggregatePercentage =
      mod.aggregateTotal > 0
        ? Math.round(
            (mod.aggregateDemonstrated / mod.aggregateTotal) * PERCENTAGE_SCALE
          )
        : 0;
  }

  return Array.from(moduleMap.values());
}

function buildModuleTreeFromSectionIds(
  profileProgress: ProfileProgress
): ModuleNode[] {
  const moduleMap = new Map<string, ModuleNode>();

  for (const section of profileProgress.sections) {
    const moduleId = deriveModuleId(section.section_id);
    const moduleTitle = `Module ${moduleId}`;

    if (!moduleMap.has(moduleId)) {
      moduleMap.set(moduleId, {
        module_id: moduleId,
        module_title: moduleTitle,
        sections: [],
        aggregatePercentage: 0,
        aggregateDemonstrated: 0,
        aggregateTotal: 0,
      });
    }

    const mod = moduleMap.get(moduleId)!;
    mod.sections.push({
      section_id: section.section_id,
      section_title: `Section ${section.section_id}`,
      status: section.status,
      claimProgress: section.claim_progress
        ? {
            demonstrated: section.claim_progress.demonstrated,
            total: section.claim_progress.total,
            percentage: section.claim_progress.percentage,
          }
        : undefined,
    });

    if (section.claim_progress) {
      mod.aggregateDemonstrated += section.claim_progress.demonstrated;
      mod.aggregateTotal += section.claim_progress.total;
    }
  }

  for (const mod of moduleMap.values()) {
    mod.aggregatePercentage =
      mod.aggregateTotal > 0
        ? Math.round(
            (mod.aggregateDemonstrated / mod.aggregateTotal) * PERCENTAGE_SCALE
          )
        : 0;
  }

  return Array.from(moduleMap.values());
}

/** Derive module ID from section ID prefix, e.g. "1" from "1.1" */
function deriveModuleId(sectionId: string): string {
  const dotIndex = sectionId.indexOf(".");
  return dotIndex > 0 ? sectionId.slice(0, dotIndex) : sectionId;
}

/* ---- Chevron icon ---- */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn(
        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
        open && CHEVRON_ROTATE_OPEN
      )}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6 3l5 5-5 5V3z" />
    </svg>
  );
}

/* ---- Module header ---- */

function ModuleHeader({
  module: mod,
  open,
  onToggle,
}: {
  module: ModuleNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      data-testid={`module-header-${mod.module_id}`}
    >
      <ChevronIcon open={open} />
      <span className="flex-1 truncate text-sm font-medium text-foreground">
        {mod.module_title}
      </span>
      {mod.aggregateTotal > 0 && (
        <span
          className="shrink-0 text-xs text-muted-foreground"
          data-testid={`module-percentage-${mod.module_id}`}
        >
          {mod.aggregatePercentage}%
        </span>
      )}
    </button>
  );
}

/* ---- Section row ---- */

function SectionRow({
  section,
  selected,
  onSelect,
}: {
  section: SectionNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 pl-8 text-left transition-colors",
        selected ? "bg-primary/10" : "hover:bg-muted/30"
      )}
      data-testid={`section-row-${section.section_id}`}
    >
      <ProgressBadge
        status={section.status as "not_started" | "in_progress" | "completed" | "needs_review"}
        claimProgress={section.claimProgress}
      />
      <span className="flex-1 truncate text-xs text-foreground">
        {section.section_title}
      </span>
    </button>
  );
}

/* ---- Profile header ---- */

function ProfileHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-3 py-2.5 text-left"
      data-testid="profile-header"
    >
      <ChevronIcon open={open} />
      <span className="flex-1 truncate text-sm font-semibold text-foreground">
        {title}
      </span>
    </button>
  );
}

/* ---- Main CurriculumTree component ---- */

export function CurriculumTree({
  selectedUserId,
  selectedProfile,
  selectedSection,
  onSelectSection,
  adminFetch: fetchFn,
}: CurriculumTreeProps) {
  const [progressData, setProgressData] =
    useState<UserProgressResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Collapsible state: profiles and modules */
  const [collapsedProfiles, setCollapsedProfiles] = useState<Set<string>>(
    new Set()
  );
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(
    new Set()
  );

  /* Fetch progress when user changes */
  useEffect(() => {
    if (!selectedUserId) {
      setProgressData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFn<UserProgressResponse>(
      `/api/admin/users/${selectedUserId}/progress`
    )
      .then((data) => {
        if (!cancelled) {
          setProgressData(data);
          setCollapsedProfiles(new Set());
          setCollapsedModules(new Set());
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load progress"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUserId, fetchFn]);

  /* Auto-expand the profile containing the selected section */
  useEffect(() => {
    if (selectedProfile && collapsedProfiles.has(selectedProfile)) {
      setCollapsedProfiles((prev) => {
        const next = new Set(prev);
        next.delete(selectedProfile);
        return next;
      });
    }
  }, [selectedProfile]);

  /* Build tree structure */
  const profileTrees = useMemo(() => {
    if (!progressData) return [];
    return progressData.profiles.map((p) => ({
      profile: p.profile,
      title: p.title,
      modules: buildModuleTree(p),
    }));
  }, [progressData]);

  const toggleProfile = useCallback((profile: string) => {
    setCollapsedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(profile)) {
        next.delete(profile);
      } else {
        next.add(profile);
      }
      return next;
    });
  }, []);

  const toggleModule = useCallback((key: string) => {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  /* Empty state: no user selected */
  if (!selectedUserId) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 text-center"
        data-testid="curriculum-tree-empty"
      >
        <p className="text-sm text-muted-foreground">
          Select a user to view their progress
        </p>
      </div>
    );
  }

  /* Loading state */
  if (loading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4"
        data-testid="curriculum-tree-loading"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading progress...</p>
        </div>
      </div>
    );
  }

  /* Error state */
  if (error) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 text-center"
        data-testid="curriculum-tree-error"
      >
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  /* No activity state */
  if (profileTrees.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 text-center"
        data-testid="curriculum-tree-no-activity"
      >
        <p className="text-sm text-muted-foreground">
          This learner has not started any curricula
        </p>
      </div>
    );
  }

  /* Render the tree */
  return (
    <div
      className="flex h-full flex-col overflow-y-auto"
      data-testid="curriculum-tree"
    >
      {profileTrees.map((pt) => {
        const profileOpen = !collapsedProfiles.has(pt.profile);

        return (
          <div key={pt.profile} data-testid={`profile-${pt.profile}`}>
            <ProfileHeader
              title={pt.title}
              open={profileOpen}
              onToggle={() => toggleProfile(pt.profile)}
            />

            {profileOpen &&
              pt.modules.map((mod) => {
                const moduleKey = `${pt.profile}::${mod.module_id}`;
                const moduleOpen = !collapsedModules.has(moduleKey);

                return (
                  <div key={moduleKey}>
                    <ModuleHeader
                      module={mod}
                      open={moduleOpen}
                      onToggle={() => toggleModule(moduleKey)}
                    />

                    {moduleOpen &&
                      mod.sections.map((sec) => (
                        <SectionRow
                          key={sec.section_id}
                          section={sec}
                          selected={
                            selectedProfile === pt.profile &&
                            selectedSection === sec.section_id
                          }
                          onSelect={() =>
                            onSelectSection(pt.profile, sec.section_id)
                          }
                        />
                      ))}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
