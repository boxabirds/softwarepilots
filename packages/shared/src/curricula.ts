/* ---- Types ---- */

export type LearnerProfile = "new-grad" | "veteran" | "senior-leader";

export interface CurriculumMeta {
  profile: LearnerProfile;
  title: string;
  starting_position: string;
  tutor_guidance: string;
}

export interface SectionMeta {
  id: string;
  module_id: string;
  module_title: string;
  title: string;
  markdown: string;
  key_intuition: string;
  concepts: string[];
}

/** Internal shape used by per-profile data files */
export interface CurriculumData {
  meta: CurriculumMeta;
  modules: {
    id: string;
    title: string;
    sections: {
      id: string;
      title: string;
      key_intuition: string;
      markdown: string;
    }[];
  }[];
}

export interface CurriculumProfileSummary {
  profile: LearnerProfile;
  title: string;
  starting_position: string;
  module_count: number;
  section_count: number;
}

/* ---- Registry ---- */

import { newGradCurriculum } from "./curricula/new-grad";
import { veteranCurriculum } from "./curricula/veteran";
import { seniorLeaderCurriculum } from "./curricula/senior-leader";

const ALL_PROFILES: LearnerProfile[] = ["new-grad", "veteran", "senior-leader"];

const curricula: Record<LearnerProfile, CurriculumData> = {
  "new-grad": newGradCurriculum,
  veteran: veteranCurriculum,
  "senior-leader": seniorLeaderCurriculum,
};

/* ---- Helpers ---- */

const BOLD_HEADER_RE = /\*\*(.+?)(?:\s*[-–:])?\*\*/gm;
const EXCLUDED_CONCEPTS = ["Exercise", "Key intuition to develop"];

export function extractConcepts(markdown: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = BOLD_HEADER_RE.exec(markdown)) !== null) {
    const label = match[1].trim();
    if (!EXCLUDED_CONCEPTS.some((exc) => label.includes(exc))) {
      matches.push(label);
    }
  }
  return [...new Set(matches)];
}

function assertValidProfile(profile: string): asserts profile is LearnerProfile {
  if (!(profile in curricula)) {
    throw new Error(`Unknown learner profile: ${profile}`);
  }
}

function flattenSections(data: CurriculumData): SectionMeta[] {
  const sections: SectionMeta[] = [];
  for (const mod of data.modules) {
    for (const sec of mod.sections) {
      sections.push({
        id: sec.id,
        module_id: mod.id,
        module_title: mod.title,
        title: sec.title,
        markdown: sec.markdown,
        key_intuition: sec.key_intuition,
        concepts: extractConcepts(sec.markdown),
      });
    }
  }
  return sections;
}

/* ---- Accessors ---- */

export function getCurriculumProfiles(): CurriculumProfileSummary[] {
  return ALL_PROFILES.map((profile) => {
    const data = curricula[profile];
    const sectionCount = data.modules.reduce(
      (sum, mod) => sum + mod.sections.length,
      0,
    );
    return {
      profile,
      title: data.meta.title,
      starting_position: data.meta.starting_position,
      module_count: data.modules.length,
      section_count: sectionCount,
    };
  });
}

export function getCurriculumMeta(profile: string): CurriculumMeta {
  assertValidProfile(profile);
  return { ...curricula[profile].meta };
}

/**
 * Returns all sections for a profile, without markdown content (for listing).
 */
export function getCurriculumSections(
  profile: string,
): Omit<SectionMeta, "markdown">[] {
  assertValidProfile(profile);
  return flattenSections(curricula[profile]).map(
    ({ markdown: _markdown, ...rest }) => rest,
  );
}

/**
 * Returns a single section with full markdown content.
 */
export function getSection(profile: string, sectionId: string): SectionMeta {
  assertValidProfile(profile);
  const sections = flattenSections(curricula[profile]);
  const section = sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new Error(
      `Unknown section "${sectionId}" for profile "${profile}"`,
    );
  }
  return section;
}
