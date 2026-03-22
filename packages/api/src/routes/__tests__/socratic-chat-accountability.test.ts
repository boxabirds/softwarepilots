import { describe, it, expect } from "bun:test";
import {
  buildSocraticTools,
  buildSocraticSystemPrompt,
  parseSocraticResponse,
} from "../socratic-chat";
import {
  getCurriculumMeta,
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";
import type { CurriculumMeta, SectionMeta } from "@softwarepilots/shared";
import type { GeminiFunctionCallResponse } from "../../lib/gemini";

/* ---- Helpers ---- */

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

const getToolNames = (
  section: SectionMeta,
  meta: CurriculumMeta
): string[] => {
  const tools = buildSocraticTools(section, meta);
  return tools[0].functionDeclarations.map((d) => d.name as string);
};

/* ---- Fixtures: enriched curriculum (level-1 = new-grad, accountability_scope: single-app) ---- */

const L1_PROFILE = "level-1" as const;
const L1_META = getCurriculumMeta(L1_PROFILE);
const L1_SECTIONS = getCurriculumSections(L1_PROFILE);
const L1_SECTION_WITH_SIMS = getSection(L1_PROFILE, L1_SECTIONS[0].id);

/* ---- Fixtures: level-0 has accountability_scope: learning ---- */

const L0_PROFILE = "level-0" as const;
const L0_META = getCurriculumMeta(L0_PROFILE);
const L0_SECTIONS = getCurriculumSections(L0_PROFILE);
const L0_SECTION_WITH_SIMS = getSection(L0_PROFILE, L0_SECTIONS[0].id);

/* ---- Fixture: section without simulation_scenarios (synthetic) ---- */

const SECTION_NO_ENRICHMENT: SectionMeta = {
  id: "test-plain",
  module_id: "mod-plain",
  module_title: "Plain Module",
  title: "Plain Section",
  markdown: "# No enrichment",
  key_intuition: "Just the basics",
  concepts: ["concept-a", "concept-b"],
  learning_map: {
    section_id: "test-plain",
    generated_at: "",
    model_used: "",
    prerequisites: [],
    core_claims: [],
    key_misconceptions: [],
    key_intuition_decomposition: [],
  },
};

const META_NO_ENRICHMENT: CurriculumMeta = {
  profile: "level-0",
  title: "Plain Curriculum",
  starting_position: "None",
  tutor_guidance: "Be helpful",
};

/* ---- Tool presence with enriched curriculum ---- */

describe("buildSocraticTools - accountability_probe", () => {
  it("includes accountability_probe when meta has accountability_scope", () => {
    expect(L1_META.accountability_scope).toBe("single-app");
    const names = getToolNames(L1_SECTION_WITH_SIMS, L1_META);
    expect(names).toContain("accountability_probe");
  });

  it("accountability_probe has required parameters: response, topic, dimension", () => {
    const tools = buildSocraticTools(L1_SECTION_WITH_SIMS, L1_META);
    const probe = tools[0].functionDeclarations.find(
      (d) => d.name === "accountability_probe"
    );
    expect(probe).toBeDefined();
    const params = probe!.parameters as Record<string, unknown>;
    expect(params.required).toEqual(["response", "topic", "dimension"]);
  });

  it("includes accountability_probe for all scope levels", () => {
    // level-0 = learning, level-1 = single-app, level-10 = system-of-services, level-20 = org-practices
    const profiles = ["level-0", "level-1", "level-10", "level-20"] as const;
    for (const profile of profiles) {
      const meta = getCurriculumMeta(profile);
      expect(meta.accountability_scope).toBeDefined();
      const sections = getCurriculumSections(profile);
      const section = getSection(profile, sections[0].id);
      const names = getToolNames(section, meta);
      expect(names).toContain("accountability_probe");
    }
  });
});

/* ---- Tool presence with simulation scenarios ---- */

describe("buildSocraticTools - simulation_readiness_check", () => {
  it("includes simulation_readiness_check when section has simulation_scenarios", () => {
    expect(L1_SECTION_WITH_SIMS.simulation_scenarios).toBeDefined();
    expect(L1_SECTION_WITH_SIMS.simulation_scenarios!.length).toBeGreaterThan(0);
    const names = getToolNames(L1_SECTION_WITH_SIMS, L1_META);
    expect(names).toContain("simulation_readiness_check");
  });

  it("simulation_readiness_check has required parameters", () => {
    const tools = buildSocraticTools(L1_SECTION_WITH_SIMS, L1_META);
    const simTool = tools[0].functionDeclarations.find(
      (d) => d.name === "simulation_readiness_check"
    );
    expect(simTool).toBeDefined();
    const params = simTool!.parameters as Record<string, unknown>;
    expect(params.required).toEqual([
      "scenario_ids",
      "readiness",
      "gaps",
      "recommendation",
    ]);
  });

  it("includes simulation_readiness_check for level-0 section with scenarios", () => {
    expect(L0_SECTION_WITH_SIMS.simulation_scenarios).toBeDefined();
    const names = getToolNames(L0_SECTION_WITH_SIMS, L0_META);
    expect(names).toContain("simulation_readiness_check");
  });
});

/* ---- Tool absence without enrichment ---- */

describe("buildSocraticTools - absence without enrichment", () => {
  it("excludes accountability_probe when meta lacks accountability_scope", () => {
    expect(META_NO_ENRICHMENT.accountability_scope).toBeUndefined();
    const names = getToolNames(SECTION_NO_ENRICHMENT, META_NO_ENRICHMENT);
    expect(names).not.toContain("accountability_probe");
  });

  it("excludes simulation_readiness_check when section lacks simulation_scenarios", () => {
    expect(SECTION_NO_ENRICHMENT.simulation_scenarios).toBeUndefined();
    const names = getToolNames(SECTION_NO_ENRICHMENT, META_NO_ENRICHMENT);
    expect(names).not.toContain("simulation_readiness_check");
  });

  it("still includes all base tools for non-enriched section", () => {
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
    const names = getToolNames(SECTION_NO_ENRICHMENT, META_NO_ENRICHMENT);
    for (const baseName of BASE_TOOL_NAMES) {
      expect(names).toContain(baseName);
    }
  });

  it("includes track_concepts when section has concepts (backward compat)", () => {
    expect(SECTION_NO_ENRICHMENT.concepts.length).toBeGreaterThan(0);
    const names = getToolNames(SECTION_NO_ENRICHMENT, META_NO_ENRICHMENT);
    expect(names).toContain("track_concepts");
  });
});

/* ---- Tool output parsing ---- */

describe("parseSocraticResponse - accountability_probe", () => {
  it("accountability_probe is a REPLY_TOOL - produces visible reply", () => {
    const result = parseSocraticResponse(
      geminiResponse("accountability_probe", {
        response: "How would you diagnose this issue in your app?",
        topic: "error handling",
        dimension: "diagnosis",
      })
    );
    expect(result.tool_type).toBe("accountability_probe");
    expect(result.reply).toBe("How would you diagnose this issue in your app?");
    expect(result.topic).toBe("error handling");
    expect(result.dimension).toBe("diagnosis");
  });

  it("accountability_probe provides default reply when response is missing", () => {
    const result = parseSocraticResponse(
      geminiResponse("accountability_probe", {
        topic: "testing",
        dimension: "verification",
      })
    );
    expect(result.reply).toContain("responsibilities");
    expect(result.topic).toBe("testing");
    expect(result.dimension).toBe("verification");
  });

  it("accountability_probe combined with track_concepts", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "track_concepts",
          args: {
            concepts_demonstrated: '["error handling"]',
            concept_levels: '["developing"]',
          },
        },
        {
          name: "accountability_probe",
          args: {
            response: "When this error happens in production, what do you check first?",
            topic: "error handling",
            dimension: "diagnosis",
          },
        },
      ])
    );
    expect(result.tool_type).toBe("track_concepts+accountability_probe");
    expect(result.reply).toBe(
      "When this error happens in production, what do you check first?"
    );
    expect(result.concepts_demonstrated).toEqual(["error handling"]);
    expect(result.dimension).toBe("diagnosis");
  });
});

describe("parseSocraticResponse - simulation_readiness_check", () => {
  it("simulation_readiness_check is a SIDE_EFFECT_TOOL - no reply text", () => {
    const result = parseSocraticResponse(
      geminiMultiResponse([
        {
          name: "simulation_readiness_check",
          args: {
            scenario_ids: '["S1.1", "S1.2"]',
            readiness: "approaching",
            gaps: '["error classification"]',
            recommendation: "Review error types before attempting simulation",
          },
        },
        {
          name: "socratic_probe",
          args: {
            response: "Can you classify the three main error types?",
            topic: "error classification",
            confidence_assessment: "medium",
          },
        },
      ])
    );
    expect(result.tool_type).toBe(
      "simulation_readiness_check+socratic_probe"
    );
    // Reply comes from the socratic_probe, not simulation_readiness_check
    expect(result.reply).toBe("Can you classify the three main error types?");
    expect(result.readiness).toBe("approaching");
    expect(result.gaps).toEqual(["error classification"]);
    expect(result.recommendation).toBe(
      "Review error types before attempting simulation"
    );
  });

  it("simulation_readiness_check alone produces empty reply", () => {
    const result = parseSocraticResponse(
      geminiResponse("simulation_readiness_check", {
        scenario_ids: '["S1.1"]',
        readiness: "ready",
        gaps: "[]",
        recommendation: "Proceed to simulation",
      })
    );
    expect(result.tool_type).toBe("simulation_readiness_check");
    expect(result.reply).toBe("");
    expect(result.readiness).toBe("ready");
    expect(result.recommendation).toBe("Proceed to simulation");
  });

  it("simulation_readiness_check with comma-separated gaps fallback", () => {
    const result = parseSocraticResponse(
      geminiResponse("simulation_readiness_check", {
        scenario_ids: '["S1.1"]',
        readiness: "not_ready",
        gaps: "error types, debugging steps",
        recommendation: "Cover basics first",
      })
    );
    expect(result.gaps).toEqual(["error types", "debugging steps"]);
  });
});

/* ---- System prompt content ---- */

describe("buildSocraticSystemPrompt - accountability context", () => {
  it("includes accountability context block for single-app scope", () => {
    const prompt = buildSocraticSystemPrompt(L1_META, L1_SECTION_WITH_SIMS, []);
    expect(prompt).toContain("== Accountability Context ==");
    expect(prompt).toContain("single-app");
    expect(prompt).toContain(
      "responsible for a single application's correctness and reliability"
    );
    expect(prompt).toContain("accountability_probe");
  });

  it("includes correct description for learning scope", () => {
    const prompt = buildSocraticSystemPrompt(L0_META, L0_SECTION_WITH_SIMS, []);
    expect(prompt).toContain("learning");
    expect(prompt).toContain(
      "exploring concepts without production responsibility"
    );
  });

  it("includes correct description for system-of-services scope", () => {
    const vetMeta = getCurriculumMeta("level-10");
    const vetSections = getCurriculumSections("level-10");
    const vetSection = getSection("level-10", vetSections[0].id);
    const prompt = buildSocraticSystemPrompt(vetMeta, vetSection, []);
    expect(prompt).toContain("system-of-services");
    expect(prompt).toContain(
      "accountable for interconnected services and their failure modes"
    );
  });

  it("includes correct description for org-practices scope", () => {
    const slMeta = getCurriculumMeta("level-20");
    const slSections = getCurriculumSections("level-20");
    const slSection = getSection("level-20", slSections[0].id);
    const prompt = buildSocraticSystemPrompt(slMeta, slSection, []);
    expect(prompt).toContain("org-practices");
    expect(prompt).toContain(
      "shaping engineering practices and standards across the organization"
    );
  });

  it("includes four accountability dimensions in prompt", () => {
    const prompt = buildSocraticSystemPrompt(L1_META, L1_SECTION_WITH_SIMS, []);
    expect(prompt).toContain("diagnosis");
    expect(prompt).toContain("verification");
    expect(prompt).toContain("escalation");
    expect(prompt).toContain("sign_off");
  });

  it("omits accountability context when meta has no accountability_scope", () => {
    const prompt = buildSocraticSystemPrompt(
      META_NO_ENRICHMENT,
      SECTION_NO_ENRICHMENT,
      []
    );
    expect(prompt).not.toContain("== Accountability Context ==");
    expect(prompt).not.toContain("accountability_probe");
  });
});

describe("buildSocraticSystemPrompt - simulation scenarios", () => {
  it("includes simulation scenario references when section has them", () => {
    const prompt = buildSocraticSystemPrompt(L1_META, L1_SECTION_WITH_SIMS, []);
    expect(prompt).toContain("== Simulation Scenarios ==");
    expect(prompt).toContain("simulation_readiness_check");
    for (const scenario of L1_SECTION_WITH_SIMS.simulation_scenarios!) {
      expect(prompt).toContain(scenario);
    }
  });

  it("omits simulation scenarios block when section has none", () => {
    const prompt = buildSocraticSystemPrompt(
      META_NO_ENRICHMENT,
      SECTION_NO_ENRICHMENT,
      []
    );
    expect(prompt).not.toContain("== Simulation Scenarios ==");
    expect(prompt).not.toContain("simulation_readiness_check");
  });
});

/* ---- Mixed state: some sections enriched, others not ---- */

describe("buildSocraticTools - mixed enrichment state", () => {
  it("conditionally includes tools per-section enrichment", () => {
    // Enriched section (has both accountability_scope via meta and simulation_scenarios)
    const enrichedNames = getToolNames(L1_SECTION_WITH_SIMS, L1_META);
    expect(enrichedNames).toContain("accountability_probe");
    expect(enrichedNames).toContain("simulation_readiness_check");

    // Non-enriched section (no accountability_scope, no simulation_scenarios)
    const plainNames = getToolNames(SECTION_NO_ENRICHMENT, META_NO_ENRICHMENT);
    expect(plainNames).not.toContain("accountability_probe");
    expect(plainNames).not.toContain("simulation_readiness_check");
  });

  it("meta with accountability_scope but section without simulation_scenarios", () => {
    // Use real meta (has accountability_scope) with synthetic section (no sim scenarios)
    const names = getToolNames(SECTION_NO_ENRICHMENT, L1_META);
    expect(names).toContain("accountability_probe");
    expect(names).not.toContain("simulation_readiness_check");
  });

  it("meta without accountability_scope but section with simulation_scenarios", () => {
    // Use synthetic meta (no accountability_scope) with real section (has sim scenarios)
    const sectionWithSims: SectionMeta = {
      ...SECTION_NO_ENRICHMENT,
      simulation_scenarios: ["S1.1", "S1.2"],
    };
    const names = getToolNames(sectionWithSims, META_NO_ENRICHMENT);
    expect(names).not.toContain("accountability_probe");
    expect(names).toContain("simulation_readiness_check");
  });
});
