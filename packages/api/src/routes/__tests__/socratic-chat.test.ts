import { describe, it, expect } from "bun:test";
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
  "session_pause",
  "lesson_query",
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

const TEST_PROFILE = "level-1" as const;
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
      (d) => d.name !== "track_concepts" && d.name !== "claim_assessment" && d.name !== "session_complete" && d.name !== "session_pause" && d.name !== "lesson_query"
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
            acknowledgment: "Great work today! Let's take a break.",
            pause_reason: "fatigue_detected",
            concepts_covered_so_far: "variables, scope",
            resume_suggestion: "Try again after reviewing the docs",
          },
        },
      ])
    );
    expect(result.reply).toBe("Great work today! Let's take a break.");
    expect(result.pause_reason).toBe("fatigue_detected");
    expect(result.concepts_covered_so_far).toBe("variables, scope");
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
      profile: "level-1",
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
      profile: "level-1",
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
      profile: "level-1",
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

// Base 9 + accountability_probe (TEST_META has accountability_scope) + simulation_readiness_check (TEST_SECTION has simulation_scenarios) + claim_assessment (learning_map has claims)
const EXPECTED_BASE_TOOL_COUNT = 12;
// Base + track_concepts + accountability_probe + simulation_readiness_check + claim_assessment
const EXPECTED_CONCEPTS_TOOL_COUNT = 13;

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
  });
});

/* ---- session_pause tool ---- */

describe("session_pause tool declaration", () => {
  it("includes session_pause in base tool declarations", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).toContain("session_pause");
  });

  it("has correct required parameters", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const pauseTool = tools[0].functionDeclarations.find(
      (d) => d.name === "session_pause"
    );
    expect(pauseTool).toBeTruthy();
    const params = pauseTool!.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toContain("acknowledgment");
    expect(required).toContain("pause_reason");
    expect(required).toContain("concepts_covered_so_far");
    expect(required).toContain("resume_suggestion");
  });

  it("has pause_reason enum with correct values", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const pauseTool = tools[0].functionDeclarations.find(
      (d) => d.name === "session_pause"
    );
    const params = pauseTool!.parameters as Record<string, Record<string, Record<string, unknown>>>;
    const pauseReasonEnum = params.properties.pause_reason.enum as string[];
    expect(pauseReasonEnum).toEqual([
      "learner_requested",
      "frustration_detected",
      "fatigue_detected",
    ]);
  });
});

describe("session_pause parser", () => {
  it("extracts acknowledgment, pause_reason, concepts_covered_so_far, and resume_suggestion", () => {
    const result = parseSocraticResponse(
      geminiResponse("session_pause", {
        acknowledgment: "You've done great work today!",
        pause_reason: "learner_requested",
        concepts_covered_so_far: "variables, functions, scope",
        resume_suggestion: "Next time we can explore closures",
      })
    );
    expect(result.tool_type).toBe("session_pause");
    expect(result.reply).toBe("You've done great work today!");
    expect(result.pause_reason).toBe("learner_requested");
    expect(result.concepts_covered_so_far).toBe("variables, functions, scope");
    expect(result.resume_suggestion).toBe("Next time we can explore closures");
  });

  it("falls back to message field when acknowledgment is missing", () => {
    const result = parseSocraticResponse(
      geminiResponse("session_pause", {
        message: "Take a break!",
        pause_reason: "fatigue_detected",
        concepts_covered_so_far: "basics",
        resume_suggestion: "Review notes",
      })
    );
    expect(result.reply).toBe("Take a break!");
  });

  it("handles session_pause + track_concepts combo", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "track_concepts",
          args: {
            concepts_demonstrated: '["variables", "scope"]',
            concept_levels: '["solid", "developing"]',
          },
        },
        {
          name: "session_pause",
          args: {
            acknowledgment: "Great progress! Let's pause here.",
            pause_reason: "frustration_detected",
            concepts_covered_so_far: "variables, scope",
            resume_suggestion: "We'll pick up with closures",
          },
        },
      ])
    );

    expect(result.tool_type).toBe("track_concepts+session_pause");
    expect(result.reply).toBe("Great progress! Let's pause here.");
    expect(result.pause_reason).toBe("frustration_detected");
    expect(result.concepts_covered_so_far).toBe("variables, scope");
    expect(result.resume_suggestion).toBe("We'll pick up with closures");
    expect(result.concepts_demonstrated).toEqual(["variables", "scope"]);
    expect(result.concept_levels).toEqual(["solid", "developing"]);
  });
});

describe("session_pause system prompt guidance", () => {
  it("includes session_pause guidance in system prompt", () => {
    const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, []);
    expect(prompt).toContain("session_pause");
    expect(prompt).toContain("frustration");
    expect(prompt).toContain("fatigued");
    expect(prompt).toContain("Never say 'you seem tired'");
  });
});

/* ---- lesson_query tool ---- */

describe("lesson_query tool declaration", () => {
  it("is in tool declarations", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).toContain("lesson_query");
  });

  it("has response and query_type as required parameters", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const queryTool = tools[0].functionDeclarations.find(
      (d) => d.name === "lesson_query"
    );
    expect(queryTool).toBeDefined();
    const params = queryTool!.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toContain("response");
    expect(required).toContain("query_type");
  });

  it("query_type enum has all 5 values", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const queryTool = tools[0].functionDeclarations.find(
      (d) => d.name === "lesson_query"
    );
    const params = queryTool!.parameters as Record<string, Record<string, Record<string, unknown>>>;
    const queryTypeEnum = params.properties.query_type.enum as string[];
    expect(queryTypeEnum).toEqual([
      "objectives",
      "remaining_topics",
      "needs_attention",
      "overall_assessment",
      "general",
    ]);
  });
});

describe("lesson_query parser", () => {
  it("extracts response and query_type", () => {
    const result = parseSocraticResponse(
      geminiResponse("lesson_query", {
        response: "This section covers three main concepts.",
        query_type: "objectives",
        topics_referenced: "variables, scope, closures",
      })
    );
    expect(result.tool_type).toBe("lesson_query");
    expect(result.reply).toBe("This section covers three main concepts.");
    expect(result.query_type).toBe("objectives");
    expect(result.topics_referenced).toBe("variables, scope, closures");
  });

  it("handles lesson_query without optional topics_referenced", () => {
    const result = parseSocraticResponse(
      geminiResponse("lesson_query", {
        response: "You've covered 3 out of 5 topics.",
        query_type: "overall_assessment",
      })
    );
    expect(result.reply).toBe("You've covered 3 out of 5 topics.");
    expect(result.query_type).toBe("overall_assessment");
    expect(result.topics_referenced).toBeUndefined();
  });
});

describe("lesson_query system prompt guidance", () => {
  it("includes lesson_query guidance in system prompt", () => {
    const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, []);
    expect(prompt).toContain("lesson_query");
    expect(prompt).toContain("learning objectives");
    expect(prompt).toContain("What topics haven't I covered");
  });
});

/* ---- accountability_probe tool ---- */

import type { AccountabilityScope } from "@softwarepilots/shared";

const META_WITH_ACCOUNTABILITY: CurriculumMeta = {
  ...TEST_META,
  accountability_scope: "single-app" as AccountabilityScope,
};

const META_WITHOUT_ACCOUNTABILITY: CurriculumMeta = {
  ...TEST_META,
};
// Ensure no accountability_scope is set
delete (META_WITHOUT_ACCOUNTABILITY as unknown as Record<string, unknown>).accountability_scope;

const SECTION_WITH_SIMULATIONS: SectionMeta = {
  ...TEST_SECTION,
  simulation_scenarios: ["sim-outage-01", "sim-deploy-02"],
};

const SECTION_WITHOUT_SIMULATIONS: SectionMeta = {
  ...TEST_SECTION,
};
// Ensure no simulation_scenarios is set
delete (SECTION_WITHOUT_SIMULATIONS as unknown as Record<string, unknown>).simulation_scenarios;

const EXPECTED_BASE_PLUS_CONCEPTS_COUNT = 11;

describe("accountability_probe tool declaration", () => {
  it("is added when meta has accountability_scope", () => {
    const tools = buildSocraticTools(TEST_SECTION, META_WITH_ACCOUNTABILITY);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).toContain("accountability_probe");
  });

  it("is NOT added when meta lacks accountability_scope", () => {
    const tools = buildSocraticTools(TEST_SECTION, META_WITHOUT_ACCOUNTABILITY);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).not.toContain("accountability_probe");
  });

  it("has topic, dimension (enum), and response as required parameters", () => {
    const tools = buildSocraticTools(TEST_SECTION, META_WITH_ACCOUNTABILITY);
    const probeTool = tools[0].functionDeclarations.find(
      (d) => d.name === "accountability_probe"
    );
    expect(probeTool).toBeDefined();
    const params = probeTool!.parameters as Record<string, unknown>;
    const properties = params.properties as Record<string, Record<string, unknown>>;
    const required = params.required as string[];

    expect(required).toContain("response");
    expect(required).toContain("topic");
    expect(required).toContain("dimension");

    expect(properties.dimension.enum).toEqual([
      "diagnosis",
      "verification",
      "escalation",
      "sign_off",
    ]);
  });
});

describe("accountability_probe parser", () => {
  it("extracts response, topic, and dimension", () => {
    const result = parseSocraticResponse(
      geminiResponse("accountability_probe", {
        response: "If this service failed at 2am, what would you check first?",
        topic: "incident response",
        dimension: "diagnosis",
      })
    );
    expect(result.tool_type).toBe("accountability_probe");
    expect(result.reply).toContain("If this service failed");
    expect(result.topic).toBe("incident response");
    expect(result.dimension).toBe("diagnosis");
  });

  it("provides default reply when response is missing", () => {
    const result = parseSocraticResponse(
      geminiResponse("accountability_probe", {
        topic: "deployment",
        dimension: "sign_off",
      })
    );
    expect(result.reply).toContain("responsibilities");
  });

  it("works in multi-tool with track_concepts", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "track_concepts",
          args: {
            concepts_demonstrated: '["monitoring"]',
            concept_levels: '["developing"]',
          },
        },
        {
          name: "accountability_probe",
          args: {
            response: "Who would you escalate this to?",
            topic: "escalation paths",
            dimension: "escalation",
          },
        },
      ])
    );
    expect(result.tool_type).toBe("track_concepts+accountability_probe");
    expect(result.reply).toBe("Who would you escalate this to?");
    expect(result.dimension).toBe("escalation");
    expect(result.concepts_demonstrated).toEqual(["monitoring"]);
  });
});

describe("accountability_probe system prompt", () => {
  it("includes accountability context when meta has accountability_scope", () => {
    const prompt = buildSocraticSystemPrompt(
      META_WITH_ACCOUNTABILITY,
      TEST_SECTION,
      []
    );
    expect(prompt).toContain("Accountability Context");
    expect(prompt).toContain("single-app");
    expect(prompt).toContain("accountability_probe");
    expect(prompt).toContain("diagnosis");
    expect(prompt).toContain("verification");
    expect(prompt).toContain("escalation");
    expect(prompt).toContain("sign_off");
  });

  it("does NOT include accountability context when meta lacks accountability_scope", () => {
    const prompt = buildSocraticSystemPrompt(
      META_WITHOUT_ACCOUNTABILITY,
      TEST_SECTION,
      []
    );
    expect(prompt).not.toContain("Accountability Context");
    expect(prompt).not.toContain("accountability_probe");
  });
});

/* ---- simulation_readiness_check tool ---- */

describe("simulation_readiness_check tool declaration", () => {
  it("is added when section has simulation_scenarios", () => {
    const tools = buildSocraticTools(SECTION_WITH_SIMULATIONS, TEST_META);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).toContain("simulation_readiness_check");
  });

  it("is NOT added when section lacks simulation_scenarios", () => {
    const tools = buildSocraticTools(SECTION_WITHOUT_SIMULATIONS, TEST_META);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).not.toContain("simulation_readiness_check");
  });

  it("has scenario_ids, readiness, gaps, recommendation as required parameters", () => {
    const tools = buildSocraticTools(SECTION_WITH_SIMULATIONS, TEST_META);
    const simTool = tools[0].functionDeclarations.find(
      (d) => d.name === "simulation_readiness_check"
    );
    expect(simTool).toBeDefined();
    const params = simTool!.parameters as Record<string, unknown>;
    const properties = params.properties as Record<string, Record<string, unknown>>;
    const required = params.required as string[];

    expect(required).toContain("scenario_ids");
    expect(required).toContain("readiness");
    expect(required).toContain("gaps");
    expect(required).toContain("recommendation");

    expect(properties.readiness.enum).toEqual([
      "not_ready",
      "approaching",
      "ready",
    ]);
  });
});

describe("simulation_readiness_check parser", () => {
  it("extracts readiness, gaps, and recommendation as side-effect (no reply text)", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "simulation_readiness_check",
          args: {
            scenario_ids: '["sim-outage-01"]',
            readiness: "approaching",
            gaps: '["monitoring basics", "alert thresholds"]',
            recommendation: "Review monitoring concepts before attempting the simulation",
          },
        },
      ])
    );
    expect(result.tool_type).toBe("simulation_readiness_check");
    expect(result.reply).toBe(""); // side-effect, no reply
    expect(result.readiness).toBe("approaching");
    expect(result.gaps).toEqual(["monitoring basics", "alert thresholds"]);
    expect(result.recommendation).toBe(
      "Review monitoring concepts before attempting the simulation"
    );
  });

  it("works alongside a reply tool", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "evaluate_response",
          args: {
            assessment: "Good understanding of monitoring!",
            follow_up: "Let's see if you're ready for a hands-on scenario.",
            understanding_level: "solid",
            topic: "monitoring",
          },
        },
        {
          name: "simulation_readiness_check",
          args: {
            scenario_ids: '["sim-outage-01"]',
            readiness: "ready",
            gaps: "[]",
            recommendation: "Proceed to simulation",
          },
        },
      ])
    );
    expect(result.tool_type).toBe(
      "evaluate_response+simulation_readiness_check"
    );
    expect(result.reply).toContain("Good understanding of monitoring!");
    expect(result.readiness).toBe("ready");
    expect(result.gaps).toEqual([]);
    expect(result.recommendation).toBe("Proceed to simulation");
  });

  it("handles comma-separated gaps fallback", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "simulation_readiness_check",
          args: {
            scenario_ids: '["sim-deploy-02"]',
            readiness: "not_ready",
            gaps: "rollback strategy, canary deploys",
            recommendation: "Cover deployment patterns first",
          },
        },
      ])
    );
    expect(result.gaps).toEqual(["rollback strategy", "canary deploys"]);
  });
});

describe("simulation_readiness_check system prompt", () => {
  it("includes simulation scenarios when section has them", () => {
    const prompt = buildSocraticSystemPrompt(
      TEST_META,
      SECTION_WITH_SIMULATIONS,
      []
    );
    expect(prompt).toContain("Simulation Scenarios");
    expect(prompt).toContain("sim-outage-01");
    expect(prompt).toContain("sim-deploy-02");
    expect(prompt).toContain("simulation_readiness_check");
  });

  it("does NOT include simulation block when section lacks scenarios", () => {
    const prompt = buildSocraticSystemPrompt(
      TEST_META,
      SECTION_WITHOUT_SIMULATIONS,
      []
    );
    expect(prompt).not.toContain("Simulation Scenarios");
    expect(prompt).not.toContain("simulation_readiness_check");
  });
});

/* ---- backward compatibility ---- */

const PLAIN_SECTION_WITH_CONCEPTS: SectionMeta = {
  ...SECTION_WITH_CONCEPTS,
};
delete (PLAIN_SECTION_WITH_CONCEPTS as unknown as Record<string, unknown>).simulation_scenarios;

// base 9 + track_concepts + claim_assessment = 11
const EXPECTED_PLAIN_CONCEPTS_COUNT = 11;

describe("backward compatibility with non-enriched curricula", () => {
  it("tool count unchanged when meta has no accountability_scope and section has no simulation_scenarios", () => {
    const tools = buildSocraticTools(PLAIN_SECTION_WITH_CONCEPTS, META_WITHOUT_ACCOUNTABILITY);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    expect(names).toHaveLength(EXPECTED_PLAIN_CONCEPTS_COUNT);
    expect(names).not.toContain("accountability_probe");
    expect(names).not.toContain("simulation_readiness_check");
  });

  it("adds both new tools when both enrichments present", () => {
    const enrichedSection: SectionMeta = {
      ...SECTION_WITH_CONCEPTS,
      simulation_scenarios: ["sim-test-01"],
    };
    const tools = buildSocraticTools(enrichedSection, META_WITH_ACCOUNTABILITY);
    const names = tools[0].functionDeclarations.map((d) => d.name as string);
    // base 9 + track_concepts + claim_assessment + accountability_probe + simulation_readiness_check = 13
    const EXPECTED_FULLY_ENRICHED_COUNT = 13;
    expect(names).toHaveLength(EXPECTED_FULLY_ENRICHED_COUNT);
    expect(names).toContain("accountability_probe");
    expect(names).toContain("simulation_readiness_check");
    expect(names).toContain("track_concepts");
  });

  it("system prompt unchanged for basic meta and section", () => {
    const prompt = buildSocraticSystemPrompt(
      META_WITHOUT_ACCOUNTABILITY,
      SECTION_WITHOUT_SIMULATIONS,
      []
    );
    expect(prompt).not.toContain("Accountability Context");
    expect(prompt).not.toContain("Simulation Scenarios");
    // Core content still present
    expect(prompt).toContain("Socratic tutor");
    expect(prompt).toContain(META_WITHOUT_ACCOUNTABILITY.tutor_guidance);
  });
});
