/**
 * Context assembly for the Socratic tutor system prompt.
 *
 * Builds structured context blocks from curriculum content, conversation
 * history, and summaries for injection into the LLM system prompt.
 */

import {
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";

/* ---- Constants ---- */

const TOKEN_BUDGET = 8000;
const WORDS_TO_TOKENS_RATIO = 1.3;

/* ---- Curriculum context ---- */

/**
 * Builds a structured curriculum context block for the system prompt.
 *
 * For the current section: includes FULL markdown content.
 * For other sections: includes title + key_intuition + concept list.
 * If total estimated tokens exceed TOKEN_BUDGET, non-current sections
 * are truncated to title only.
 *
 * Returns empty string for unknown profiles.
 */
export function buildCurriculumContext(
  profile: string,
  currentSectionId: string
): string {
  let sections: Array<{
    id: string;
    module_id: string;
    module_title: string;
    title: string;
    key_intuition: string;
    concepts: string[];
  }>;

  try {
    sections = getCurriculumSections(profile);
  } catch {
    return "";
  }

  // Get full markdown for current section
  let currentSection: { id: string; title: string; markdown: string; key_intuition: string; concepts: string[] };
  try {
    currentSection = getSection(profile, currentSectionId);
  } catch {
    return "";
  }

  const lines: string[] = ["== Curriculum Content =="];

  // Build current section block
  const currentBlock = [
    "",
    `--- Current Section: ${currentSection.id} "${currentSection.title}" ---`,
    currentSection.markdown,
  ];

  // Build other section summaries (full: title + key_intuition + concepts)
  const otherSectionsFull: string[] = [];
  const otherSectionsMinimal: string[] = [];

  for (const sec of sections) {
    if (sec.id === currentSectionId) continue;

    // Full summary: title + key_intuition + concepts
    const fullLines = [
      `- ${sec.id} "${sec.title}": ${sec.key_intuition}`,
    ];
    if (sec.concepts.length > 0) {
      fullLines.push(`  Concepts: ${sec.concepts.join(", ")}`);
    }
    otherSectionsFull.push(fullLines.join("\n"));

    // Minimal summary: title only
    otherSectionsMinimal.push(`- ${sec.id} "${sec.title}"`);
  }

  // Estimate tokens for the full version
  const fullOtherBlock = otherSectionsFull.length > 0
    ? [
        "",
        "--- Other Sections (summary) ---",
        ...otherSectionsFull,
      ]
    : [];

  const fullText = [...currentBlock, ...fullOtherBlock].join("\n");
  const wordCount = fullText.split(/\s+/).length;
  const estimatedTokens = wordCount * WORDS_TO_TOKENS_RATIO;

  if (estimatedTokens <= TOKEN_BUDGET) {
    lines.push(...currentBlock);
    if (fullOtherBlock.length > 0) {
      lines.push(...fullOtherBlock);
    }
  } else {
    // Truncate non-current sections to title only
    lines.push(...currentBlock);
    if (otherSectionsMinimal.length > 0) {
      lines.push(
        "",
        "--- Other Sections (titles only, truncated for space) ---",
        ...otherSectionsMinimal,
      );
    }
  }

  return lines.join("\n");
}
