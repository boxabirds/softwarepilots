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

const EXPECTED_TOOL_COUNT = 6;

const EXPECTED_TOOL_NAMES = [
  "socratic_probe",
  "present_scenario",
  "evaluate_response",
  "surface_key_insight",
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

const TEST_PROFILE = "new-grad" as const;
const TEST_META = getCurriculumMeta(TEST_PROFILE);
const TEST_SECTIONS = getCurriculumSections(TEST_PROFILE);
const TEST_SECTION = getSection(TEST_PROFILE, TEST_SECTIONS[0].id);

/* ---- buildSocraticTools ---- */

describe("buildSocraticTools", () => {
  it("produces exactly 5 tools with correct names", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const names = tools[0].functionDeclarations.map(
      (d) => d.name as string
    );
    expect(names).toHaveLength(EXPECTED_TOOL_COUNT);
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
  });

  it("includes section title in tool descriptions (except session_complete)", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const contextualTools = tools[0].functionDeclarations.filter(
      (d) => d.name !== "session_complete"
    );
    const descriptions = contextualTools.map(
      (d) => d.description as string
    );
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
    expect(prompt).toContain("Never lecture");
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

  it("handles session_complete and extracts structured fields", () => {
    const result = parseSocraticResponse(
      geminiResponse("session_complete", {
        summary: "We covered variables, types, and scope.",
        final_understanding: "solid",
        concepts_covered: "variables, types, scope",
        concepts_missed: "closures",
        recommendation: "Move on to functions",
      })
    );
    expect(result.tool_type).toBe("session_complete");
    expect(result.reply).toContain("variables, types, and scope");
    expect(result.final_understanding).toBe("solid");
    expect(result.concepts_covered).toEqual(["variables", "types", "scope"]);
    expect(result.concepts_missed).toEqual(["closures"]);
    expect(result.recommendation).toBe("Move on to functions");
  });

  it("handles session_complete with minimal fields", () => {
    const result = parseSocraticResponse(
      geminiResponse("session_complete", {
        summary: "Good session!",
        final_understanding: "developing",
        concepts_covered: "basics",
      })
    );
    expect(result.tool_type).toBe("session_complete");
    expect(result.reply).toBe("Good session!");
    expect(result.final_understanding).toBe("developing");
    expect(result.concepts_covered).toEqual(["basics"]);
    expect(result.concepts_missed).toEqual([]);
    expect(result.recommendation).toBeUndefined();
  });

  it("throws on unexpected tool name", () => {
    expect(() =>
      parseSocraticResponse(
        geminiResponse("unknown_tool", { foo: "bar" })
      )
    ).toThrow("Unexpected tool: unknown_tool");
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
