/* ---- Types ---- */

export type LearnerProfile = "level-0" | "level-1" | "level-10" | "level-20";

export type AccountabilityScope =
  | "learning"
  | "single-app"
  | "system-of-services"
  | "org-practices";

export interface CurriculumMeta {
  profile: LearnerProfile;
  title: string;
  starting_position: string;
  tutor_guidance: string;
  accountability_scope?: AccountabilityScope;
}

export interface Claim {
  id: string;
  statement: string;
  concepts: string[];
  demonstration_criteria: string;
}

export interface Misconception {
  id: string;
  belief: string;
  correction: string;
  related_claims: string[];
}

export interface SubInsight {
  id: string;
  statement: string;
  order: number;
}

export interface SectionLearningMap {
  section_id: string;
  generated_at: string;
  model_used: string;
  prerequisites: string[];
  core_claims: Claim[];
  key_misconceptions: Misconception[];
  key_intuition_decomposition: SubInsight[];
}

export interface SectionMeta {
  id: string;
  module_id: string;
  module_title: string;
  title: string;
  markdown: string;
  key_intuition: string;
  concepts: string[];
  learning_map: SectionLearningMap;
  simulation_scenarios?: string[];
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
      simulation_scenarios?: string[];
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

import { level0Curriculum } from "./curricula/level-0";
import { newGradCurriculum } from "./curricula/new-grad";
import { veteranCurriculum } from "./curricula/veteran";
import { seniorLeaderCurriculum } from "./curricula/senior-leader";
import { getLearningMap, getLearningMapForProfile, learningMapRegistry } from "./curricula/learning-maps";

export { learningMapRegistry, getLearningMap, getLearningMapForProfile };

const ALL_PROFILES: LearnerProfile[] = ["level-0", "level-1", "level-10", "level-20"];

const curricula: Record<LearnerProfile, CurriculumData> = {
  "level-0": level0Curriculum,
  "level-1": newGradCurriculum,
  "level-10": veteranCurriculum,
  "level-20": seniorLeaderCurriculum,
};

/* ---- Helpers ---- */

const BOLD_HEADER_RE = /\*\*(.+?)(?:\s*[-–:])?\*\*/gm;
const EXCLUDED_CONCEPTS = [
  "Exercise",
  "Key intuition to develop",
  "Accountability context",
  "Key concepts",
  "Key vocabulary",
  "Why this matters for pilotry",
  "Why this matters",
  "The physical reality",
  "Graduation requirements",
  "The medical analogy",
];

/** Patterns that indicate a bold header is structural, not a learnable concept. */
const STRUCTURAL_PATTERNS = [
  /^Why .+ happen/,           // "Why fixation loops happen"
  /^How to /,                 // "How to break a fixation loop"
  /^What /i,                  // Question-form headers
  /^Does /i,
  /^Do /i,
  /^Are /i,
  /^Is /i,
  /^Has /i,
  /^S\d+\.\d+ - /,           // Section references like "S2.1 - Bug Taxonomy Building"
  /^"[^"]+"/,                 // Quoted phrases like '"Make it good"'
  /\.$$/,                     // Ends with period (sentences, not concepts)
];

export function extractConcepts(markdown: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = BOLD_HEADER_RE.exec(markdown)) !== null) {
    const label = match[1].trim();
    if (EXCLUDED_CONCEPTS.some((exc) => label.includes(exc))) continue;
    if (STRUCTURAL_PATTERNS.some((pat) => pat.test(label))) continue;
    matches.push(label);
  }
  return [...new Set(matches)];
}

function assertValidProfile(profile: string): asserts profile is LearnerProfile {
  if (!(profile in curricula)) {
    throw new Error(`Unknown learner profile: ${profile}`);
  }
}

const EMPTY_LEARNING_MAP: SectionLearningMap = {
  section_id: "",
  generated_at: "",
  model_used: "",
  prerequisites: [],
  core_claims: [],
  key_misconceptions: [],
  key_intuition_decomposition: [],
};

function flattenSections(data: CurriculumData, profile?: string): SectionMeta[] {
  const sections: SectionMeta[] = [];
  for (const mod of data.modules) {
    for (const sec of mod.sections) {
      const registeredMap = profile
        ? getLearningMapForProfile(profile, sec.id) ?? getLearningMap(sec.id)
        : getLearningMap(sec.id);
      if (!registeredMap) {
        console.warn(
          `Learning map not found for section "${sec.id}" - using empty placeholder`
        );
      }
      sections.push({
        id: sec.id,
        module_id: mod.id,
        module_title: mod.title,
        title: sec.title,
        markdown: sec.markdown,
        key_intuition: sec.key_intuition,
        concepts: extractConcepts(sec.markdown),
        learning_map: registeredMap ?? { ...EMPTY_LEARNING_MAP, section_id: sec.id },
        ...(sec.simulation_scenarios && {
          simulation_scenarios: sec.simulation_scenarios,
        }),
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
  return flattenSections(curricula[profile], profile).map(
    ({ markdown: _markdown, ...rest }) => rest,
  );
}

/**
 * Returns a single section with full markdown content.
 */
export function getSection(profile: string, sectionId: string): SectionMeta {
  assertValidProfile(profile);
  const sections = flattenSections(curricula[profile], profile);
  const section = sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new Error(
      `Unknown section "${sectionId}" for profile "${profile}"`,
    );
  }
  return section;
}
