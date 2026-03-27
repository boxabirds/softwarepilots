/**
 * Unit tests for learning map generation prompt and pipeline (Story 61).
 *
 * Tests prompt assembly and the generate-with-retry pipeline using mocked Gemini.
 * Does NOT test real Gemini API calls (that's in soak tests).
 */

import { describe, it, expect, afterEach } from "bun:test";
import { buildLearningMapPrompt, generateLearningMap } from "../learning-map-generator";
import type { SectionLearningMap } from "@softwarepilots/shared";

const PROMPT_TEMPLATE = `You are an expert curriculum designer for a software engineering education platform called "Software Pilots". Your task is to generate a structured learning map for a curriculum section.

## Section ID: {{section_id}}

## Key Intuition
{{key_intuition}}

## Concepts extracted from this section
{{concepts_list}}

## Section Content
{{markdown}}

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
  "section_id": "{{section_id}}",
  "generated_at": "<ISO timestamp>",
  "model_used": "{{model}}",
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

/* ---- Fixtures ---- */

const SECTION_ID = "0.1";
const MARKDOWN = "## Systems Vocabulary\n\n**Server**: a computer that responds to requests.\n\n**Database**: stores data persistently.";
const KEY_INTUITION = "You cannot be accountable for something you cannot name.";
const CONCEPTS = ["Server", "Database"];

const VALID_MAP: SectionLearningMap = {
  section_id: "0.1",
  generated_at: "2025-01-01T00:00:00Z",
  model_used: "gemini-2.0-flash",
  prerequisites: [],
  core_claims: [
    { id: "claim-1", statement: "Servers respond to requests", concepts: ["Server"], demonstration_criteria: "Can explain what happens when a server receives a request" },
    { id: "claim-2", statement: "Databases store data", concepts: ["Database"], demonstration_criteria: "Can identify when data needs persistent storage" },
    { id: "claim-3", statement: "Both are infrastructure", concepts: ["Server", "Database"], demonstration_criteria: "Can describe how servers and databases work together" },
  ],
  key_misconceptions: [
    { id: "misconception-1", belief: "Servers never fail", correction: "Servers have limited resources", related_claims: ["claim-1"] },
  ],
  key_intuition_decomposition: [
    { id: "insight-1", statement: "Naming enables reasoning", order: 1 },
    { id: "insight-2", statement: "Reasoning enables accountability", order: 2 },
  ],
};

const INVALID_MAP_VAGUE: SectionLearningMap = {
  ...VALID_MAP,
  core_claims: [
    { id: "claim-1", statement: "Servers are important", concepts: ["Server"], demonstration_criteria: "Understands what a server is" },
    { id: "claim-2", statement: "Databases matter", concepts: ["Database"], demonstration_criteria: "Knows about databases" },
    { id: "claim-3", statement: "Both are needed", concepts: ["Server", "Database"], demonstration_criteria: "Is aware of infrastructure needs" },
  ],
};

/* ---- Gemini fetch mock helpers ---- */

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockGeminiResponse(map: SectionLearningMap) {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(map) }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )) as unknown as typeof fetch;
}

function mockGeminiSequence(responses: Array<SectionLearningMap | Error>) {
  let callIndex = 0;
  globalThis.fetch = (() => {
    const response = responses[callIndex++];
    if (response instanceof Error) {
      return Promise.reject(response);
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }) as unknown as typeof fetch;
}

function mockGeminiError(status: number, message: string) {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(message, { status }),
    )) as unknown as typeof fetch;
}

/* ---- Prompt assembly ---- */

describe("buildLearningMapPrompt", () => {
  it("includes section ID", () => {
    const prompt = buildLearningMapPrompt(PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS);
    expect(prompt).toContain("## Section ID: 0.1");
  });

  it("includes key intuition", () => {
    const prompt = buildLearningMapPrompt(PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS);
    expect(prompt).toContain(KEY_INTUITION);
  });

  it("includes all concepts as bullet list", () => {
    const prompt = buildLearningMapPrompt(PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS);
    expect(prompt).toContain("- Server");
    expect(prompt).toContain("- Database");
  });

  it("includes full markdown content", () => {
    const prompt = buildLearningMapPrompt(PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS);
    expect(prompt).toContain(MARKDOWN);
  });

  it("includes validation rules", () => {
    const prompt = buildLearningMapPrompt(PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS);
    expect(prompt).toContain("exactly 3 to 7 claims");
    expect(prompt).toContain("NEVER use phrases like");
    expect(prompt).toContain("demonstration_criteria");
  });

  it("includes model name in JSON schema", () => {
    const prompt = buildLearningMapPrompt(PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS, "gemini-2.0-flash");
    expect(prompt).toContain('"model_used": "gemini-2.0-flash"');
  });

  it("handles empty concepts array", () => {
    const prompt = buildLearningMapPrompt(PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, []);
    expect(prompt).toContain("## Concepts extracted from this section");
  });
});

/* ---- Generate with validation + retry ---- */

describe("generateLearningMap", () => {
  it("returns valid map on first attempt", async () => {
    mockGeminiResponse(VALID_MAP);

    const result = await generateLearningMap(
      "fake-key", PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS,
      { retryDelayMs: 0 },
    );

    expect(result.section_id).toBe("0.1");
    expect(result.core_claims).toHaveLength(3);
  });

  it("retries on validation failure and succeeds", async () => {
    mockGeminiSequence([INVALID_MAP_VAGUE, VALID_MAP]);

    const result = await generateLearningMap(
      "fake-key", PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS,
      { maxRetries: 1, retryDelayMs: 0 },
    );

    expect(result.section_id).toBe("0.1");
    expect(result.core_claims).toHaveLength(3);
  });

  it("throws after all retries fail validation", async () => {
    mockGeminiResponse(INVALID_MAP_VAGUE);

    await expect(
      generateLearningMap(
        "fake-key", PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS,
        { maxRetries: 1, retryDelayMs: 0 },
      ),
    ).rejects.toThrow("Failed to generate valid learning map");
  });

  it("retries on Gemini API error and succeeds", async () => {
    mockGeminiSequence([new Error("API timeout"), VALID_MAP]);

    const result = await generateLearningMap(
      "fake-key", PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS,
      { maxRetries: 1, retryDelayMs: 0 },
    );

    expect(result.core_claims).toHaveLength(3);
  });

  it("throws after all retries fail with API errors", async () => {
    mockGeminiSequence([new Error("fail 1"), new Error("fail 2"), new Error("fail 3")]);

    await expect(
      generateLearningMap(
        "fake-key", PROMPT_TEMPLATE, SECTION_ID, MARKDOWN, KEY_INTUITION, CONCEPTS,
        { maxRetries: 2, retryDelayMs: 0 },
      ),
    ).rejects.toThrow("Failed to generate valid learning map");
  });
});
