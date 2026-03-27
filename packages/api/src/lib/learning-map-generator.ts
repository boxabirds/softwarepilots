/**
 * Learning map generation from curriculum content via Gemini API.
 *
 * Extracted from scripts/generate-learning-maps.ts for shared use
 * between the generation script and the API package.
 */

import type { SectionLearningMap } from "@softwarepilots/shared";
import { validateLearningMap } from "@softwarepilots/shared";

/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 30_000;
const GENERATION_TEMPERATURE = 0.3;

/* ---- Prompt assembly ---- */

/**
 * Build the prompt that instructs Gemini to produce a SectionLearningMap.
 * Exported for testing.
 */
export function buildLearningMapPrompt(
  sectionId: string,
  markdown: string,
  keyIntuition: string,
  concepts: string[],
  model: string = DEFAULT_GEMINI_MODEL,
): string {
  return `You are an expert curriculum designer for a software engineering education platform called "Software Pilots". Your task is to generate a structured learning map for a curriculum section.

## Section ID: ${sectionId}

## Key Intuition
${keyIntuition}

## Concepts extracted from this section
${concepts.map((c) => `- ${c}`).join("\n")}

## Section Content
${markdown}

## Instructions

Generate a SectionLearningMap JSON object with the following structure. Be precise and specific - avoid vague language.

Rules:
- core_claims: exactly 3 to 7 claims. Each claim must have a unique id (format: "claim-N"), a clear statement, at least one concept from the section concepts list, and specific demonstration_criteria.
- CRITICAL: demonstration_criteria must be specific and actionable. NEVER use phrases like "understands", "knows", "is aware of", "familiar with", or "has knowledge of". Instead use phrases like "Can explain...", "Can identify...", "Can build...", "Can compare...", "Can diagnose...", etc.
- CRITICAL: Every concept from the section concepts list must appear in at least one claim's concepts array.
- key_misconceptions: 1 to 3 common misconceptions. Each must reference valid claim IDs in related_claims.
- key_intuition_decomposition: exactly 2 to 4 sub-insights that break down the key intuition. Each has a unique id (format: "insight-N"), a statement, and an order number starting from 1.
- prerequisites: list any prerequisite section IDs or concepts (can be empty array).

Return ONLY valid JSON matching this exact schema:
{
  "section_id": "${sectionId}",
  "generated_at": "<ISO timestamp>",
  "model_used": "${model}",
  "prerequisites": ["string"],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "string",
      "concepts": ["string"],
      "demonstration_criteria": "string"
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "string",
      "correction": "string",
      "related_claims": ["claim-1"]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "string",
      "order": 1
    }
  ]
}`;
}

/* ---- Gemini API call ---- */

/**
 * Call Gemini to generate a learning map from a prompt.
 * Returns the raw parsed SectionLearningMap (not yet validated).
 */
export async function callGeminiForMap(
  apiKey: string,
  prompt: string,
  model: string = DEFAULT_GEMINI_MODEL,
): Promise<SectionLearningMap> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: GENERATION_TEMPERATURE,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No text in Gemini response");
  }

  return JSON.parse(text) as SectionLearningMap;
}

/* ---- Generate with validation + retry ---- */

export interface GenerateOptions {
  model?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Generate a validated SectionLearningMap from section content.
 * Retries up to maxRetries times on validation failure.
 * Throws if all attempts fail validation or Gemini errors.
 */
export async function generateLearningMap(
  apiKey: string,
  sectionId: string,
  markdown: string,
  keyIntuition: string,
  concepts: string[],
  options: GenerateOptions = {},
): Promise<SectionLearningMap> {
  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;

  const prompt = buildLearningMapPrompt(sectionId, markdown, keyIntuition, concepts, model);
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    try {
      const map = await callGeminiForMap(apiKey, prompt, model);
      const validation = validateLearningMap(map, concepts);

      if (validation.valid) {
        return map;
      }

      lastErrors = validation.errors;
      console.warn(
        `Learning map validation failed for ${sectionId} (attempt ${attempt + 1}/${maxRetries + 1}):`,
        validation.errors,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastErrors = [message];
      console.warn(
        `Learning map generation error for ${sectionId} (attempt ${attempt + 1}/${maxRetries + 1}):`,
        message,
      );
    }
  }

  throw new Error(
    `Failed to generate valid learning map for ${sectionId} after ${maxRetries + 1} attempts. Last errors: ${lastErrors.join("; ")}`,
  );
}
