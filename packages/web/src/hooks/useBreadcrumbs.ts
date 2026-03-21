import { useLocation, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiClient } from "../lib/api-client";
import { getCurriculumSections, getSection } from "@softwarepilots/shared";

export interface BreadcrumbSegment {
  label: string;
  href?: string; // undefined = current page (not clickable)
}

/** Convert a profile slug like 'new-grad' to title case: 'New Grad' */
function formatProfileName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Cache for progress percentages keyed by profile */
const progressCache = new Map<string, number | null>();

function useProfileProgress(profile: string | undefined): number | null {
  const [progress, setProgress] = useState<number | null>(
    profile ? (progressCache.get(profile) ?? null) : null,
  );

  useEffect(() => {
    if (!profile) return;

    if (progressCache.has(profile)) {
      setProgress(progressCache.get(profile) ?? null);
      return;
    }

    let cancelled = false;

    apiClient
      .get<Array<{ status: string }>>(`/api/curriculum/${profile}/progress`)
      .then((sections) => {
        if (cancelled) return;
        const total = sections.length;
        if (total === 0) {
          progressCache.set(profile, null);
          setProgress(null);
          return;
        }
        const completed = sections.filter(
          (s) => s.status === "completed",
        ).length;
        const pct = Math.round((completed / total) * 100);
        progressCache.set(profile, pct);
        setProgress(pct);
      })
      .catch(() => {
        if (!cancelled) {
          progressCache.set(profile, null);
          setProgress(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return progress;
}

export function useBreadcrumbs(): BreadcrumbSegment[] {
  const location = useLocation();
  const params = useParams<{
    profile?: string;
    sectionId?: string;
    moduleId?: string;
    exerciseId?: string;
  }>();

  const profile = params.profile;
  const sectionId = params.sectionId;
  const pathname = location.pathname;

  const progress = useProfileProgress(profile);

  // /dashboard - logo handles home navigation
  if (pathname === "/dashboard") {
    return [];
  }

  // /curriculum (no profile)
  if (pathname === "/curriculum") {
    return [
            { label: "Curriculum" },
    ];
  }

  // Routes with a profile param
  if (profile) {
    const profileLabel =
      progress !== null
        ? `${formatProfileName(profile)} (${progress}%)`
        : formatProfileName(profile);

    // /curriculum/:profile/progress
    if (pathname.endsWith("/progress")) {
      return [
                { label: profileLabel, href: "/curriculum" },
        { label: "Progress" },
      ];
    }

    // /curriculum/:profile/:sectionId
    if (sectionId) {
      let sectionTitle = sectionId;
      let moduleTitle = "";
      try {
        const section = getSection(profile, sectionId);
        sectionTitle = section.title;
        moduleTitle = section.module_title;
      } catch {
        // Fall back to sectionId if getSection fails
      }

      const segments: BreadcrumbSegment[] = [
        { label: profileLabel, href: "/curriculum" },
      ];
      if (moduleTitle) {
        segments.push({ label: moduleTitle });
      }
      return segments;
    }
  }

  // /exercise/:moduleId/:exerciseId
  if (params.moduleId && params.exerciseId) {
    return [
            { label: "Exercise" },
    ];
  }

  // Fallback
  return [];
}
