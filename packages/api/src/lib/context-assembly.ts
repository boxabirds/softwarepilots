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
import { GEMINI_API_URL } from "./gemini";

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

/* ---- Conversation compression ---- */

const SUMMARIZATION_TEMPERATURE = 0.3;

/**
 * Compresses a conversation into a summary using Gemini text generation.
 * Returns null on failure (non-critical operation).
 */
export async function compressConversation(
  apiKey: string,
  model: string,
  messages: Array<{ role: "user" | "tutor"; content: string }>,
  sectionTitle: string,
  summarizationPrompt: string
): Promise<string | null> {
  if (!messages || messages.length === 0) return null;

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`)
    .join("\n");

  const prompt = `${summarizationPrompt}\n\nSection: "${sectionTitle}"\n\nConversation:\n${conversationText}`;

  try {
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: SUMMARIZATION_TEMPERATURE },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Persists a summary on a conversation row.
 */
export async function persistSummary(
  db: D1Database,
  conversationId: string,
  summary: string
): Promise<void> {
  await db
    .prepare("UPDATE curriculum_conversations SET summary = ? WHERE id = ?")
    .bind(summary, conversationId)
    .run();
}

/* ---- Conversation history assembly ---- */

/**
 * Builds a conversation history context block from prior session summaries.
 * Loads summaries from curriculum_conversations where summary IS NOT NULL
 * for the given learner+profile. Returns empty string if no prior sessions.
 */
export async function buildConversationContext(
  db: D1Database,
  learnerId: string,
  profile: string,
  currentSectionId: string
): Promise<string> {
  // Load all summarized conversations for this learner+profile
  const { results } = await db
    .prepare(
      `SELECT section_id, summary, archived_at
       FROM curriculum_conversations
       WHERE learner_id = ? AND profile = ? AND summary IS NOT NULL
       ORDER BY updated_at ASC`
    )
    .bind(learnerId, profile)
    .all<{ section_id: string; summary: string; archived_at: string | null }>();

  if (!results || results.length === 0) {
    return "";
  }

  // Build section title lookup
  let sectionTitleMap: Map<string, string>;
  try {
    const sections = getCurriculumSections(profile);
    sectionTitleMap = new Map(sections.map((s) => [s.id, s.title]));
  } catch {
    sectionTitleMap = new Map();
  }

  const lines = ["== Prior Sessions =="];

  // Group: archived conversations for current section first, then others
  const currentSectionSummaries: string[] = [];
  const otherSectionSummaries: string[] = [];

  for (const row of results) {
    const title = sectionTitleMap.get(row.section_id) || row.section_id;
    const entry = `Section ${row.section_id} "${title}": ${row.summary}`;

    if (row.section_id === currentSectionId && row.archived_at) {
      currentSectionSummaries.push(entry);
    } else {
      otherSectionSummaries.push(entry);
    }
  }

  if (currentSectionSummaries.length > 0) {
    lines.push("");
    lines.push("--- Previous sessions on current section ---");
    for (const s of currentSectionSummaries) {
      lines.push(`- ${s}`);
    }
  }

  if (otherSectionSummaries.length > 0) {
    lines.push("");
    lines.push("--- Sessions on other sections ---");
    for (const s of otherSectionSummaries) {
      lines.push(`- ${s}`);
    }
  }

  return lines.join("\n");
}
