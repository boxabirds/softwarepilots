/* ---- Learner profiles ---- */

export type LearnerProfile =
  | "business-leader"
  | "product-manager"
  | "designer"
  | "data-analyst";

/* ---- Section metadata ---- */

export interface SectionMeta {
  id: string;
  title: string;
  key_intuition: string;
  topics: string[];
  /** Path to the section markdown file for upload to Gemini */
  markdown_path?: string;
}

/* ---- Curriculum metadata ---- */

export interface CurriculumMeta {
  profile: LearnerProfile;
  title: string;
  /** Profile-specific pedagogical approach for the tutor */
  tutor_guidance: string;
  sections: SectionMeta[];
}

/* ---- Registry ---- */

const curricula: Record<LearnerProfile, CurriculumMeta> = {
  "business-leader": {
    profile: "business-leader",
    title: "Software Pilotry for Business Leaders",
    tutor_guidance:
      "Focus on strategic implications and decision-making. Use business analogies. " +
      "Help the learner connect technical concepts to organizational outcomes, ROI, and risk. " +
      "Avoid jargon — translate everything into business impact.",
    sections: [
      {
        id: "bl-1.1",
        title: "The Compiler Moment",
        key_intuition:
          "Software is precise and literal — it does exactly what it is told, nothing more. " +
          "Understanding this precision is the foundation of effective technical leadership.",
        topics: [
          "variable assignment",
          "arithmetic operators",
          "string concatenation",
          "type conversion",
          "boolean comparison",
        ],
      },
    ],
  },
  "product-manager": {
    profile: "product-manager",
    title: "Software Pilotry for Product Managers",
    tutor_guidance:
      "Emphasize trade-offs, user impact, and system constraints. " +
      "Help the learner reason about how technical choices affect product outcomes. " +
      "Use product scenarios and prioritization frameworks as anchors.",
    sections: [
      {
        id: "pm-1.1",
        title: "The Compiler Moment",
        key_intuition:
          "Software executes instructions literally — understanding this precision " +
          "helps PMs write better specs and anticipate edge cases.",
        topics: [
          "variable assignment",
          "arithmetic operators",
          "string concatenation",
          "type conversion",
          "boolean comparison",
        ],
      },
    ],
  },
  designer: {
    profile: "designer",
    title: "Software Pilotry for Designers",
    tutor_guidance:
      "Connect technical concepts to design systems, component behavior, and user experience. " +
      "Help the learner see how code structure maps to visual and interaction patterns. " +
      "Use design-system analogies (tokens, variants, states).",
    sections: [
      {
        id: "ds-1.1",
        title: "The Compiler Moment",
        key_intuition:
          "Software is a precise design material — it renders exactly what you specify, " +
          "making the gap between intent and implementation visible.",
        topics: [
          "variable assignment",
          "arithmetic operators",
          "string concatenation",
          "type conversion",
          "boolean comparison",
        ],
      },
    ],
  },
  "data-analyst": {
    profile: "data-analyst",
    title: "Software Pilotry for Data Analysts",
    tutor_guidance:
      "Ground concepts in data transformation, type safety, and pipeline thinking. " +
      "Help the learner see how code operates on data step by step. " +
      "Use spreadsheet and SQL analogies where helpful.",
    sections: [
      {
        id: "da-1.1",
        title: "The Compiler Moment",
        key_intuition:
          "Code processes data through explicit, typed transformations — " +
          "understanding this helps you reason about data pipelines and transformations.",
        topics: [
          "variable assignment",
          "arithmetic operators",
          "string concatenation",
          "type conversion",
          "boolean comparison",
        ],
      },
    ],
  },
};

/* ---- Accessors ---- */

export function getCurriculumMeta(profile: LearnerProfile): CurriculumMeta {
  const meta = curricula[profile];
  if (!meta) {
    throw new Error(`Unknown learner profile: ${profile}`);
  }
  return meta;
}

export function getSection(
  profile: LearnerProfile,
  sectionId: string
): SectionMeta {
  const meta = getCurriculumMeta(profile);
  const section = meta.sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new Error(
      `Unknown section "${sectionId}" for profile "${profile}"`
    );
  }
  return section;
}

export function getAllProfiles(): LearnerProfile[] {
  return Object.keys(curricula) as LearnerProfile[];
}
