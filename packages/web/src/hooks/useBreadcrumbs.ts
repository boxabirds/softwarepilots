import { useLocation, useParams } from "react-router-dom";
import { getSection, getCurriculumMeta } from "@softwarepilots/shared";
import { useTopicCoverage } from "./useTopicCoverage";

export interface BreadcrumbSegment {
  label: string;
  href?: string; // undefined = current page (not clickable)
}

/** Get the display title for a profile slug from the curriculum registry */
function formatProfileName(slug: string): string {
  try {
    return getCurriculumMeta(slug).title;
  } catch {
    return slug;
  }
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

  const coverage = useTopicCoverage(profile);

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
    const trackLabel = formatProfileName(profile);

    // /curriculum/:profile/progress
    if (pathname.endsWith("/progress")) {
      return [
                { label: trackLabel, href: "/curriculum" },
        { label: "Progress" },
      ];
    }

    // /curriculum/:profile/:sectionId
    if (sectionId) {
      let moduleTitle = "";
      let moduleId = "";
      try {
        const section = getSection(profile, sectionId);
        moduleTitle = section.module_title;
        moduleId = section.module_id;
      } catch {
        // Fall back to sectionId if getSection fails
      }

      const segments: BreadcrumbSegment[] = [
        { label: trackLabel, href: "/curriculum" },
      ];
      if (moduleTitle) {
        const moduleCov = moduleId && coverage?.modules.get(moduleId);
        const moduleLabel = moduleCov
          ? `${moduleTitle} (${moduleCov.covered}/${moduleCov.total})`
          : moduleTitle;
        segments.push({ label: moduleLabel });
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
