import { describe, it, expect } from "vitest";
import {
  buildSocraticTools,
  buildSocraticSystemPrompt,
  parseSocraticResponse,
  socraticChat,
} from "../socratic-chat";
import {
  getCurriculumMeta,
  getCurriculumSections,
  getSection,
  getCurriculumProfiles,
} from "@softwarepilots/shared";
import type { GeminiFunctionCallResponse } from "../../lib/gemini";

/* ---- Helpers ---- */

const BASE_TOOL_NAMES = [
  "socratic_probe",
  "present_scenario",
  "evaluate_response",
  "surface_key_insight",
  "provide_instruction",
  "off_topic_detected",
  "session_complete",
];

const geminiResponse = (
  name: string,
  args: Record<string, string>
): GeminiFunctionCallResponse => ({
  candidates: [
    {
      content: {
        parts: [{ functionCall: { name, args } }],
      },
    },
  ],
});

const geminiMultiResponse = (
  calls: Array<{ name: string; args: Record<string, string> }>
): GeminiFunctionCallResponse => ({
  candidates: [
    {
      content: {
        parts: calls.map((fc) => ({ functionCall: fc })),
      },
    },
  ],
});

const TEST_PROFILE = "new-grad" as const;
const TEST_META = getCurriculumMeta(TEST_PROFILE);
const TEST_SECTIONS = getCurriculumSections(TEST_PROFILE);
const TEST_SECTION = getSection(TEST_PROFILE, TEST_SECTIONS[0].id);

/* ---- buildSocraticTools ---- */

describe("buildSocraticTools", () => {
  it("produces base tools plus track_concepts when section has concepts", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const names = tools[0].functionDeclarations.map(
      (d) => d.name as string
    );
    // TEST_SECTION has concepts extracted from markdown, so track_concepts is included
    for (const baseName of BASE_TOOL_NAMES) {
      expect(names).toContain(baseName);
    }
    if (TEST_SECTION.concepts.length > 0) {
      expect(names).toContain("track_concepts");
    }
  });

  it("includes section title in base tool descriptions", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const baseDecls = tools[0].functionDeclarations.filter(
      (d) => d.name !== "track_concepts" && d.name !== "session_complete"
    );
    const descriptions = baseDecls.map((d) => d.description as string);
    for (const desc of descriptions) {
      expect(desc).toContain(TEST_SECTION.title);
    }
  });

  it("includes key_intuition in surface_key_insight description", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const surfaceTool = tools[0].functionDeclarations.find(
      (d) => d.name === "surface_key_insight"
    );
    expect(surfaceTool?.description).toContain(TEST_SECTION.key_intuition);
  });
});

/* ---- buildSocraticSystemPrompt ---- */

describe("buildSocraticSystemPrompt", () => {
  it("includes tutor_guidance for each profile", () => {
    const profiles = getCurriculumProfiles();
    for (const p of profiles) {
      const meta = getCurriculumMeta(p.profile);
      const sections = getCurriculumSections(p.profile);
      const section = getSection(p.profile, sections[0].id);
      const prompt = buildSocraticSystemPrompt(meta, section, []);
      expect(prompt).toContain(meta.tutor_guidance);
    }
  });

  it("includes section key_intuition", () => {
    const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, []);
    expect(prompt).toContain(TEST_SECTION.key_intuition);
  });

  it("includes section title and profile", () => {
    const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, []);
    expect(prompt).toContain(TEST_SECTION.title);
    expect(prompt).toContain(TEST_META.profile);
  });

  it("includes Socratic instruction to never lecture", () => {
    const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, []);
    expect(prompt).toContain("Default to Socratic questioning");
  });

  it("includes conversation context when history exists", () => {
    const conversation = [
      { role: "user" as const, content: "What is a variable?" },
      { role: "tutor" as const, content: "What do you think it is?" },
    ];
    const prompt = buildSocraticSystemPrompt(
      TEST_META,
      TEST_SECTION,
      conversation
    );
    expect(prompt).toContain("2 previous exchanges");
  });
});

/* ---- parseSocraticResponse ---- */

describe("parseSocraticResponse", () => {
  it("handles socratic_probe and extracts confidence_assessment", () => {
    const result = parseSocraticResponse(
      geminiResponse("socratic_probe", {
        response: "What happens when you add a string to a number?",
        topic: "type conversion",
        confidence_assessment: "low",
      })
    );
    expect(result.tool_type).toBe("socratic_probe");
    expect(result.reply).toContain("What happens");
    expect(result.topic).toBe("type conversion");
    expect(result.confidence_assessment).toBe("low");
  });

  it("handles present_scenario", () => {
    const result = parseSocraticResponse(
      geminiResponse("present_scenario", {
        scenario: "Imagine you're building a price calculator.",
        question: "What type should the total be?",
        topic: "arithmetic",
      })
    );
    expect(result.tool_type).toBe("present_scenario");
    expect(result.reply).toContain("price calculator");
    expect(result.reply).toContain("What type");
    expect(result.topic).toBe("arithmetic");
  });

  it("handles evaluate_response and extracts understanding_level", () => {
    const result = parseSocraticResponse(
      geminiResponse("evaluate_response", {
        assessment: "Good thinking!",
        follow_up: "Can you explain why?",
        understanding_level: "developing",
        topic: "variables",
      })
    );
    expect(result.tool_type).toBe("evaluate_response");
    expect(result.reply).toContain("Good thinking");
    expect(result.reply).toContain("Can you explain");
    expect(result.understanding_level).toBe("developing");
    expect(result.topic).toBe("variables");
  });

  it("handles surface_key_insight and extracts learner_readiness", () => {
    const result = parseSocraticResponse(
      geminiResponse("surface_key_insight", {
        bridge: "You're noticing that the computer does exactly what you say.",
        learner_readiness: "ready",
      })
    );
    expect(result.tool_type).toBe("surface_key_insight");
    expect(result.reply).toContain("exactly what you say");
    expect(result.learner_readiness).toBe("ready");
  });

  it("handles off_topic_detected", () => {
    const result = parseSocraticResponse(
      geminiResponse("off_topic_detected", {
        redirect_hint: "Let's get back to the code.",
      })
    );
    expect(result.tool_type).toBe("off_topic_detected");
    expect(result.reply).toContain("back to the code");
  });

  it("handles unknown tool name gracefully", () => {
    const result = parseSocraticResponse(
      geminiResponse("unknown_tool", { foo: "bar" })
    );
    expect(result.tool_type).toBe("unknown_tool");
    expect(result.reply).toBe("");
  });

  it("throws on empty parts", () => {
    expect(() =>
      parseSocraticResponse({
        candidates: [{ content: { parts: [] } }],
      })
    ).toThrow("No parts");
  });

  it("falls back to text when no function calls", () => {
    const result = parseSocraticResponse({
      candidates: [
        { content: { parts: [{ text: "fallback text" }] } },
      ],
    });
    expect(result.tool_type).toBe("fallback");
    expect(result.reply).toBe("fallback text");
  });

  it("provides default reply for off_topic with no hint", () => {
    const result = parseSocraticResponse(
      geminiResponse("off_topic_detected", {})
    );
    expect(result.tool_type).toBe("off_topic_detected");
    expect(result.reply).toContain("focus on the section");
  });

  it("provides default reply for socratic_probe with no response", () => {
    const result = parseSocraticResponse(
      geminiResponse("socratic_probe", {
        topic: "test",
        confidence_assessment: "medium",
      })
    );
    expect(result.reply).toBe("What do you think about that?");
  });
});

/* ---- parseSocraticResponse multi-tool ---- */

describe("parseSocraticResponse multi-tool", () => {
  it("handles 2 reply tools: evaluate_response + socratic_probe -> concatenated reply", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "evaluate_response",
          args: {
            assessment: "Good thinking!",
            follow_up: "Can you explain why?",
            understanding_level: "developing",
            topic: "variables",
          },
        },
        {
          name: "socratic_probe",
          args: {
            response: "What about edge cases?",
            topic: "error handling",
            confidence_assessment: "medium",
          },
        },
      ])
    );
    expect(result.tool_type).toBe("evaluate_response+socratic_probe");
    expect(result.reply).toContain("Good thinking!");
    expect(result.reply).toContain("Can you explain why?");
    expect(result.reply).toContain("What about edge cases?");
    // Segments joined with paragraph break
    expect(result.reply).toContain("\n\n");
    // Metadata from first tool wins
    expect(result.topic).toBe("variables");
    expect(result.understanding_level).toBe("developing");
    expect(result.confidence_assessment).toBe("medium");
  });

  it("handles track_concepts as side-effect (no reply text added)", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "track_concepts",
          args: {
            concepts_demonstrated: '["variables", "scope"]',
            concept_levels: '["solid", "emerging"]',
          },
        },
      ])
    );
    expect(result.tool_type).toBe("track_concepts");
    expect(result.reply).toBe("");
    expect(result.concepts_demonstrated).toEqual(["variables", "scope"]);
    expect(result.concept_levels).toEqual(["solid", "emerging"]);
  });

  it("handles track_concepts + socratic_probe -> reply from probe, concepts extracted", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "track_concepts",
          args: {
            concepts_demonstrated: '["closures"]',
            concept_levels: '["developing"]',
            struggle_reason: "confusing lexical scope",
          },
        },
        {
          name: "socratic_probe",
          args: {
            response: "What happens to the variable after the function returns?",
            topic: "closures",
            confidence_assessment: "low",
          },
        },
      ])
    );
    expect(result.tool_type).toBe("track_concepts+socratic_probe");
    expect(result.reply).toBe(
      "What happens to the variable after the function returns?"
    );
    expect(result.concepts_demonstrated).toEqual(["closures"]);
    expect(result.concept_levels).toEqual(["developing"]);
    expect(result.struggle_reason).toBe("confusing lexical scope");
    expect(result.topic).toBe("closures");
    expect(result.confidence_assessment).toBe("low");
  });

  it("handles track_concepts with comma-separated fallback", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "track_concepts",
          args: {
            concepts_demonstrated: "variables, scope",
          },
        },
      ])
    );
    expect(result.concepts_demonstrated).toEqual(["variables", "scope"]);
  });

  it("preserves single-tool behavior for socratic_probe", () => {
    const result = parseSocraticResponse(
      geminiResponse("socratic_probe", {
        response: "What do you think?",
        topic: "basics",
        confidence_assessment: "high",
      })
    );
    expect(result.tool_type).toBe("socratic_probe");
    expect(result.reply).toBe("What do you think?");
    expect(result.topic).toBe("basics");
    expect(result.confidence_assessment).toBe("high");
  });

  it("handles session_complete fields", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "track_concepts",
          args: {
            concepts_covered: '["variables", "types"]',
            concepts_missed: '["generics"]',
          },
        },
        {
          name: "session_complete",
          args: {
            summary: "Great session!",
            final_understanding: "solid",
          },
        },
      ])
    );
    expect(result.reply).toBe("Great session!");
    expect(result.concepts_covered).toEqual(["variables", "types"]);
    expect(result.concepts_missed).toEqual(["generics"]);
    expect(result.final_understanding).toBe("solid");
  });

  it("handles session_pause fields", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "session_pause",
          args: {
            message: "Let's take a break.",
            pause_reason: "learner fatigue",
            resume_suggestion: "Try again after reviewing the docs",
          },
        },
      ])
    );
    expect(result.reply).toBe("Let's take a break.");
    expect(result.pause_reason).toBe("learner fatigue");
    expect(result.resume_suggestion).toBe("Try again after reviewing the docs");
  });
});

/* ---- Route validation (400 errors) ---- */

describe("socratic-chat route validation", () => {
  const makeRequest = (body: Record<string, unknown>) =>
    socraticChat.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const parseJson = async (res: Response) =>
    (await res.json()) as { error: string };

  it("returns 400 for missing profile", async () => {
    const res = await makeRequest({
      section_id: "1.1",
      message: "hello",
      context: { conversation: [] },
    });
    expect(res.status).toBe(400);
    const json = await parseJson(res);
    expect(json.error).toContain("profile");
  });

  it("returns 400 for unknown section", async () => {
    const res = await makeRequest({
      profile: "new-grad",
      section_id: "nonexistent-99",
      message: "hello",
      context: { conversation: [] },
    });
    expect(res.status).toBe(400);
    const json = await parseJson(res);
    expect(json.error).toContain("nonexistent-99");
  });

  it("returns 400 for empty message", async () => {
    const res = await makeRequest({
      profile: "new-grad",
      section_id: "1.1",
      message: "   ",
      context: { conversation: [] },
    });
    expect(res.status).toBe(400);
    const json = await parseJson(res);
    expect(json.error).toContain("message");
  });

  it("returns 400 for missing message", async () => {
    const res = await makeRequest({
      profile: "new-grad",
      section_id: "1.1",
      context: { conversation: [] },
    });
    expect(res.status).toBe(400);
    const json = await parseJson(res);
    expect(json.error).toContain("message");
  });

  it("returns 400 for unknown profile", async () => {
    const res = await makeRequest({
      profile: "astronaut",
      section_id: "1.1",
      message: "hello",
      context: { conversation: [] },
    });
    expect(res.status).toBe(400);
    const json = await parseJson(res);
    expect(json.error).toContain("astronaut");
  });
});

/* ---- track_concepts tool ---- */

import type { SectionMeta, CurriculumMeta } from "@softwarepilots/shared";

const SECTION_WITH_CONCEPTS: SectionMeta = {
  ...TEST_SECTION,
  concepts: ["concurrency", "race conditions", "deadlocks"],
};

const SECTION_WITHOUT_CONCEPTS: SectionMeta = {
  ...TEST_SECTION,
  concepts: [],
};

const EXPECTED_BASE_TOOL_COUNT = 7;
const EXPECTED_CONCEPTS_TOOL_COUNT = 8;

describe("buildSocraticTools with concepts", () => {
  it("adds track_concepts tool when section has concepts", () => {
    const tools = buildSocraticTools(SECTION_WITH_CONCEPTS, TEST_META);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).toHaveLength(EXPECTED_CONCEPTS_TOOL_COUNT);
    expect(names).toContain("track_concepts");
  });

  it("does not add track_concepts when section has no concepts", () => {
    const tools = buildSocraticTools(SECTION_WITHOUT_CONCEPTS, TEST_META);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).toHaveLength(EXPECTED_BASE_TOOL_COUNT);
    expect(names).not.toContain("track_concepts");
  });

  it("includes concept list in track_concepts description", () => {
    const tools = buildSocraticTools(SECTION_WITH_CONCEPTS, TEST_META);
    const trackTool = tools[0].functionDeclarations.find(
      (d) => d.name === "track_concepts"
    );
    expect(trackTool?.description).toContain("concurrency");
    expect(trackTool?.description).toContain("race conditions");
    expect(trackTool?.description).toContain("deadlocks");
  });
});

describe("buildSocraticSystemPrompt with concepts", () => {
  it("includes section concepts when present", () => {
    const prompt = buildSocraticSystemPrompt(
      TEST_META,
      SECTION_WITH_CONCEPTS,
      []
    );
    expect(prompt).toContain("Section Concepts");
    expect(prompt).toContain("1. concurrency");
    expect(prompt).toContain("2. race conditions");
    expect(prompt).toContain("3. deadlocks");
    expect(prompt).toContain("track_concepts");
  });

  it("does not include concepts section when concepts array is empty", () => {
    const prompt = buildSocraticSystemPrompt(
      TEST_META,
      SECTION_WITHOUT_CONCEPTS,
      []
    );
    expect(prompt).not.toContain("Section Concepts");
    expect(prompt).not.toContain("track_concepts");
  });
});

describe("parseSocraticResponse with track_concepts", () => {
  it("extracts concepts from track_concepts called alongside primary tool", () => {
    const response: GeminiFunctionCallResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "evaluate_response",
                  args: {
                    assessment: "Good analysis!",
                    follow_up: "What about edge cases?",
                    understanding_level: "developing",
                    topic: "concurrency",
                  },
                },
              },
              {
                functionCall: {
                  name: "track_concepts",
                  args: {
                    concepts_demonstrated: "concurrency, race conditions",
                    concept_levels: "developing, emerging",
                  },
                },
              },
            ],
          },
        },
      ],
    };

    const result = parseSocraticResponse(response);
    expect(result.tool_type).toContain("evaluate_response");
    expect(result.tool_type).toContain("track_concepts");
    expect(result.concepts_demonstrated).toEqual([
      "concurrency",
      "race conditions",
    ]);
    expect(result.concept_levels).toEqual(["developing", "emerging"]);
  });

  it("handles track_concepts as the only tool call", () => {
    const response: GeminiFunctionCallResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "track_concepts",
                  args: {
                    concepts_demonstrated: "testing",
                    concept_levels: "solid",
                  },
                },
              },
            ],
          },
        },
      ],
    };

    const result = parseSocraticResponse(response);
    expect(result.tool_type).toBe("track_concepts");
    expect(result.concepts_demonstrated).toEqual(["testing"]);
    expect(result.concept_levels).toEqual(["solid"]);
  });

  it("returns no concepts when track_concepts is not called", () => {
    const result = parseSocraticResponse(
      geminiResponse("socratic_probe", {
        response: "Tell me more",
        topic: "testing",
        confidence_assessment: "medium",
      })
    );
    expect(result.concepts_demonstrated).toBeUndefined();
    expect(result.concept_levels).toBeUndefined();
  });
});

/* ---- provide_instruction tool ---- */

describe("provide_instruction tool", () => {
  it("has correct parameters in tool declaration", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const instructionTool = tools[0].functionDeclarations.find(
      (d) => d.name === "provide_instruction"
    );
    expect(instructionTool).toBeDefined();

    const params = instructionTool!.parameters as Record<string, unknown>;
    const properties = params.properties as Record<string, Record<string, unknown>>;
    const required = params.required as string[];

    expect(properties.instruction).toBeDefined();
    expect(properties.instruction.type).toBe("STRING");

    expect(properties.concept).toBeDefined();
    expect(properties.concept.type).toBe("STRING");

    expect(properties.struggle_reason).toBeDefined();
    expect(properties.struggle_reason.type).toBe("STRING");
    expect(properties.struggle_reason.enum).toEqual([
      "repeated_wrong_answer",
      "no_progression",
      "learner_asked",
      "low_confidence_sustained",
    ]);

    expect(required).toContain("instruction");
    expect(required).toContain("concept");
    expect(required).toContain("struggle_reason");
  });

  it("parser extracts instruction, concept, and struggle_reason", () => {
    const result = parseSocraticResponse(
      geminiResponse("provide_instruction", {
        instruction: "A variable is a named container for data.",
        concept: "variables",
        struggle_reason: "repeated_wrong_answer",
      })
    );

    expect(result.reply).toBe("A variable is a named container for data.");
    expect(result.tool_type).toBe("provide_instruction");
    expect(result.concept).toBe("variables");
    expect(result.struggle_reason).toBe("repeated_wrong_answer");
  });

  it("multi-tool: provide_instruction + socratic_probe concatenated", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "provide_instruction",
          args: {
            instruction: "A loop repeats a block of code.",
            concept: "loops",
            struggle_reason: "no_progression",
          },
        },
        {
          name: "socratic_probe",
          args: {
            response: "Can you think of when you might use a loop?",
            topic: "loops",
            confidence_assessment: "low",
          },
        },
      ])
    );

    expect(result.reply).toContain("A loop repeats a block of code.");
    expect(result.reply).toContain("Can you think of when you might use a loop?");
    expect(result.tool_type).toBe("provide_instruction+socratic_probe");
    expect(result.concept).toBe("loops");
    expect(result.struggle_reason).toBe("no_progression");
  });
});
