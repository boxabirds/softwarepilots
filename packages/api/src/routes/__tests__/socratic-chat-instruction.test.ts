import { describe, it, expect } from "bun:test";
import {
  buildSocraticTools,
  buildSocraticSystemPrompt,
} from "../socratic-chat";
import {
  getCurriculumMeta,
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";

/* ---- Helpers ---- */

const TEST_PROFILE = "level-1" as const;
const TEST_META = getCurriculumMeta(TEST_PROFILE);
const TEST_SECTIONS = getCurriculumSections(TEST_PROFILE);
const TEST_SECTION = getSection(TEST_PROFILE, TEST_SECTIONS[0].id);

/* ---- 58.1: provide_instruction tool and prompt changes ---- */

describe("provide_instruction tool definition", () => {
  it("instruction param description contains 'thorough' and 'concrete example'", () => {
    const tools = buildSocraticTools(TEST_SECTION, TEST_META);
    const declarations = tools[0].functionDeclarations;
    const provideInstruction = declarations.find(
      (d) => d.name === "provide_instruction"
    );
    expect(provideInstruction).toBeDefined();

    const params = provideInstruction!.parameters as {
      properties: Record<string, { description: string }>;
    };
    const desc = params.properties.instruction.description;
    expect(desc).toContain("thorough");
    expect(desc).toContain("concrete example");
  });
});

describe("system prompt sentence limit exemption", () => {
  const prompt = buildSocraticSystemPrompt(TEST_META, TEST_SECTION, []);

  it("contains exception for provide_instruction in the sentence limit", () => {
    expect(prompt).toContain(
      "except provide_instruction, which should be as thorough as needed"
    );
  });

  it("does NOT exempt other tools from sentence limit", () => {
    // The exemption text should only mention provide_instruction
    expect(prompt).not.toContain("except socratic_probe");
    expect(prompt).not.toContain("except evaluate_response");
    expect(prompt).not.toContain("except present_scenario");
  });

  it("provide_instruction guidance includes what/why/example structure", () => {
    expect(prompt).toContain("(1) what the concept is");
    expect(prompt).toContain("(2) why it matters in practice");
    expect(prompt).toContain("(3) a concrete example");
  });
});
