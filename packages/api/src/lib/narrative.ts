/**
 * Narrative generation for progress summaries.
 *
 * Builds a prompt and calls Gemini to produce a human-readable narrative
 * summarizing the learner's curriculum progress.
 */

import { GEMINI_API_URL } from "./gemini";

/* ---- Types ---- */

export interface ProgressStats {
  completed: number;
  in_progress: number;
  paused: number;
  not_started: number;
  total: number;
}

export interface SectionProgressData {
  section_id: string;
  title: string;
  status: string;
  understanding_level?: string;
  concepts: Record<
    string,
    { level: string; review_count: number }
  >;
}

/* ---- Prompt builder ---- */

/**
 * Builds a Gemini prompt for narrative generation from progress data.
 */
export function buildNarrativePrompt(
  progressData: SectionProgressData[],
  stats: ProgressStats,
  dueConceptsCount: number
): string {
  const lines: string[] = [];

  lines.push("You are a learning coach summarizing a student's curriculum progress.");
  lines.push("Write a brief, encouraging 2-3 sentence narrative summary of their progress.");
  lines.push("Be specific about what they've accomplished and what's ahead.");
  lines.push("Do not use bullet points or headers. Just plain prose.");
  lines.push("");
  lines.push("## Progress Data");
  lines.push(`Completed sections: ${stats.completed} of ${stats.total}`);
  lines.push(`In progress: ${stats.in_progress}`);
  lines.push(`Not started: ${stats.not_started}`);
  lines.push(`Concepts due for review: ${dueConceptsCount}`);

  if (stats.paused > 0) {
    lines.push(`Paused: ${stats.paused}`);
  }

  const strongest: string[] = [];
  const struggling: string[] = [];

  for (const section of progressData) {
    if (section.status === "completed") {
      const conceptEntries = Object.entries(section.concepts);
      const strongConcepts = conceptEntries.filter(
        ([, c]) => c.level === "solid" || c.level === "strong"
      );
      for (const [name] of strongConcepts) {
        strongest.push(name);
      }
    }

    if (section.status === "in_progress") {
      const conceptEntries = Object.entries(section.concepts);
      const weakConcepts = conceptEntries.filter(
        ([, c]) => c.level === "emerging"
      );
      for (const [name] of weakConcepts) {
        struggling.push(name);
      }
    }
  }

  if (strongest.length > 0) {
    lines.push(`Strongest areas: ${strongest.join(", ")}`);
  }
  if (struggling.length > 0) {
    lines.push(`Areas needing work: ${struggling.join(", ")}`);
  }

  return lines.join("\n");
}

/* ---- Gemini text generation (no function calling) ---- */

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

/**
 * Calls Gemini for plain text generation (no function calling / tools).
 * Returns the generated text or throws on failure.
 */
export async function generateNarrative(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as GeminiTextResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text in Gemini response");
  }

  return text.trim();
}
