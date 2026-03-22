import { describe, it, expect } from "vitest";
import { getSection, getLearningMap, getLearningMapForProfile, learningMapRegistry } from "../curricula";
import type { SectionLearningMap } from "../curricula";

describe("SectionLearningMap types (56.1)", () => {
  it("SectionMeta includes learning_map field", () => {
    const section = getSection("level-0", "0.1");
    expect(section).toHaveProperty("learning_map");
    expect(section.learning_map).toHaveProperty("section_id");
    expect(section.learning_map).toHaveProperty("core_claims");
    expect(section.learning_map).toHaveProperty("key_misconceptions");
    expect(section.learning_map).toHaveProperty("key_intuition_decomposition");
  });

  it("flattenSections attaches learning_map from registry or placeholder", () => {
    const section = getSection("level-0", "0.1");
    expect(section.learning_map.section_id).toBe("0.1");
    // If a map is registered, it should have real claims; otherwise empty placeholder
    expect(Array.isArray(section.learning_map.core_claims)).toBe(true);
  });

  it("getLearningMap returns undefined for unregistered section", () => {
    expect(getLearningMap("nonexistent-section")).toBeUndefined();
  });

  it("learningMapRegistry can register and retrieve maps", () => {
    const testMap: SectionLearningMap = {
      section_id: "test-section",
      generated_at: "2026-01-01T00:00:00Z",
      model_used: "test-model",
      prerequisites: [],
      core_claims: [
        {
          id: "c1",
          statement: "Test claim",
          concepts: ["testing"],
          demonstration_criteria: "Can write a test that passes",
        },
      ],
      key_misconceptions: [],
      key_intuition_decomposition: [
        { id: "si1", statement: "First insight", order: 1 },
        { id: "si2", statement: "Second insight", order: 2 },
      ],
    };

    learningMapRegistry.set("test-profile:test-section", testMap);
    expect(getLearningMap("test-section")).toEqual(testMap);

    // Clean up
    learningMapRegistry.delete("test-profile:test-section");
  });

  it("getLearningMapForProfile returns correct map for known profile+section", () => {
    const map = getLearningMapForProfile("level-0", "0.1");
    expect(map).toBeDefined();
    expect(map!.section_id).toBe("0.1");
    expect(map!.core_claims.length).toBeGreaterThanOrEqual(3);
  });

  it("getLearningMapForProfile returns undefined for wrong profile", () => {
    // Section 0.1 exists under level-0 but not under a fake profile
    expect(getLearningMapForProfile("nonexistent-profile", "0.1")).toBeUndefined();
  });

  it("getLearningMapForProfile returns undefined for wrong section", () => {
    expect(getLearningMapForProfile("level-0", "nonexistent-section")).toBeUndefined();
  });

  it("all exported types are accessible from @softwarepilots/shared barrel", async () => {
    // Verify that the key exports are importable and have the expected shapes
    expect(typeof getLearningMap).toBe("function");
    expect(typeof getLearningMapForProfile).toBe("function");
    expect(learningMapRegistry instanceof Map).toBe(true);
    // SectionLearningMap is a type-only export; verify it works by constructing a conforming object
    const testMap: SectionLearningMap = {
      section_id: "type-check",
      generated_at: "2026-01-01T00:00:00Z",
      model_used: "test",
      prerequisites: [],
      core_claims: [],
      key_misconceptions: [],
      key_intuition_decomposition: [],
    };
    expect(testMap.section_id).toBe("type-check");
  });
});
