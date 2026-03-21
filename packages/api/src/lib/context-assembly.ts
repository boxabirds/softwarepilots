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

const SUMMARIZATION_PROMPT = `You are summarizing a tutoring conversation for future context.
Preserve the following in your summary:
- Topics discussed and key questions asked
- Concepts the learner understood well
- Concepts the learner struggled with
- Key insights or breakthroughs
- Where the conversation left off

Write a concise paragraph (3-5 sentences). Do not use bullet points.`;

const SUMMARIZATION_TEMPERATURE = 0.3;

/**
 * Compresses a conversation into a summary using Gemini text generation.
 * Returns null on failure (non-critical operation).
 */
export async function compressConversation(
  apiKey: string,
  model: string,
  messages: Array<{ role: "user" | "tutor"; content: string }>,
  sectionTitle: string
): Promise<string | null> {
  if (!messages || messages.length === 0) return null;

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`)
    .join("\n");

  const prompt = `${SUMMARIZATION_PROMPT}\n\nSection: "${sectionTitle}"\n\nConversation:\n${conversationText}`;

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
